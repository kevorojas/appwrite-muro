// Todo lo que habla con Appwrite vive en este archivo.
// Los componentes solo llaman a estas funciones.
import {
  Account,
  Channel,
  Client,
  ID,
  Permission,
  Query,
  Realtime,
  Role,
  Storage,
  TablesDB,
} from 'appwrite'

// 1. Configuración: sale del archivo .env
const ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT
const PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID
const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID
const TABLE_ID = import.meta.env.VITE_APPWRITE_TABLE_ID
const BUCKET_ID = import.meta.env.VITE_APPWRITE_BUCKET_ID

// Si falta alguna variable, lo decimos en pantalla en vez de fallar en silencio
export const faltaConfig = Object.entries({
  VITE_APPWRITE_ENDPOINT: ENDPOINT,
  VITE_APPWRITE_PROJECT_ID: PROJECT_ID,
  VITE_APPWRITE_DATABASE_ID: DATABASE_ID,
  VITE_APPWRITE_TABLE_ID: TABLE_ID,
  VITE_APPWRITE_BUCKET_ID: BUCKET_ID,
})
  .filter(([, valor]) => !valor)
  .map(([nombre]) => nombre)

// 2. El cliente: a qué servidor y a qué proyecto le hablamos
const client = new Client()
if (faltaConfig.length === 0) {
  client.setEndpoint(ENDPOINT).setProject(PROJECT_ID)
}

// 3. Un objeto por cada servicio de Appwrite que usamos
const account = new Account(client) // usuarios y sesiones
const tablesDB = new TablesDB(client) // base de datos: tablas y filas
const storage = new Storage(client) // archivos
const realtime = new Realtime(client) // eventos en vivo por WebSocket

// ---------------------------------------------------------------
// Account: registro, login y sesión
// ---------------------------------------------------------------

// Devuelve el usuario con sesión activa, o null si no hay nadie logueado.
// Appwrite guarda la sesión en una cookie, por eso sobrevive a un F5.
export async function usuarioActual() {
  try {
    return await account.get()
  } catch {
    return null
  }
}

export async function registrarse(nombre, email, password) {
  await account.create({ userId: ID.unique(), email, password, name: nombre })
  return iniciarSesion(email, password)
}

export async function iniciarSesion(email, password) {
  await account.createEmailPasswordSession({ email, password })
  return account.get()
}

export async function cerrarSesion() {
  await account.deleteSession({ sessionId: 'current' })
  // Cerramos el WebSocket para que el próximo usuario abra uno con su propia sesión
  await realtime.disconnect()
}

// ---------------------------------------------------------------
// TablesDB: leer, crear y borrar mensajes (filas de la tabla)
// ---------------------------------------------------------------

export async function listarMensajes() {
  const respuesta = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: TABLE_ID,
    // $createdAt lo agrega Appwrite solo. Los más nuevos primero.
    queries: [Query.orderDesc('$createdAt'), Query.limit(50)],
  })
  return respuesta.rows
}

export async function publicarMensaje(usuario, texto, foto) {
  // Permisos de ESTA fila (y de su foto):
  // cualquier usuario logueado la puede leer, solo el autor la puede editar o borrar.
  const permisos = [
    Permission.read(Role.users()),
    Permission.update(Role.user(usuario.$id)),
    Permission.delete(Role.user(usuario.$id)),
  ]

  // Si hay foto, primero la subimos al bucket y nos quedamos con su id
  let fotoId = null
  if (foto) {
    const archivo = await storage.createFile({
      bucketId: BUCKET_ID,
      fileId: ID.unique(),
      file: foto,
      permissions: permisos,
    })
    fotoId = archivo.$id
  }

  // Después creamos la fila con el texto, el autor y el id de la foto
  return tablesDB.createRow({
    databaseId: DATABASE_ID,
    tableId: TABLE_ID,
    rowId: ID.unique(),
    data: {
      texto,
      autorId: usuario.$id,
      autorNombre: usuario.name || usuario.email,
      fotoId,
    },
    permissions: permisos,
  })
}

export async function borrarMensaje(mensaje) {
  await tablesDB.deleteRow({
    databaseId: DATABASE_ID,
    tableId: TABLE_ID,
    rowId: mensaje.$id,
  })
  // Si tenía foto, la borramos también para no dejar archivos huérfanos
  if (mensaje.fotoId) {
    await storage.deleteFile({ bucketId: BUCKET_ID, fileId: mensaje.fotoId })
  }
}

// ---------------------------------------------------------------
// Storage: la URL para mostrar una foto en un <img>
// ---------------------------------------------------------------

// getFileView devuelve una URL (no hace ninguna petición).
// El navegador manda la cookie de sesión, así que Appwrite aplica los permisos.
// Alternativa: getFilePreview({ ..., width: 800 }) para que Appwrite la redimensione.
export function urlDeFoto(fotoId) {
  return storage.getFileView({ bucketId: BUCKET_ID, fileId: fotoId })
}

// ---------------------------------------------------------------
// Realtime: enterarnos al instante cuando alguien publica o borra
// ---------------------------------------------------------------

// Canal de todas las filas de nuestra tabla.
// Es lo mismo que escribir: `tablesdb.${DATABASE_ID}.tables.${TABLE_ID}.rows`
const canalMensajes = Channel.tablesdb(DATABASE_ID).table(TABLE_ID).row()

// Llama a alCrear / alBorrar con la fila afectada.
// Devuelve una función para cancelar la suscripción.
export function escucharMensajes({ alCrear, alBorrar }) {
  let suscripcion = null
  let cancelada = false

  realtime
    .subscribe(canalMensajes, (evento) => {
      // evento.events trae nombres como:
      // "tablesdb.muro.tables.mensajes.rows.<id>.create"
      const fila = evento.payload
      if (evento.events.some((e) => e.endsWith('.create'))) alCrear(fila)
      if (evento.events.some((e) => e.endsWith('.delete'))) alBorrar(fila)
    })
    .then((s) => {
      // Si el componente se desmontó antes de que terminara de conectar
      if (cancelada) s.unsubscribe()
      else suscripcion = s
    })

  return () => {
    cancelada = true
    suscripcion?.unsubscribe()
  }
}

// ---------------------------------------------------------------
// Errores: traducimos los más comunes a algo entendible
// ---------------------------------------------------------------

export function mensajeDeError(error) {
  const porTipo = {
    general_unknown_origin:
      'Falta registrar la plataforma web: en la consola, agrega una plataforma Web con este hostname.',
    project_not_found: 'No existe ese proyecto: revisa VITE_APPWRITE_PROJECT_ID.',
    database_not_found: 'No existe esa base de datos: revisa VITE_APPWRITE_DATABASE_ID.',
    table_not_found: 'No existe esa tabla: revisa VITE_APPWRITE_TABLE_ID.',
    storage_bucket_not_found: 'No existe ese bucket: revisa VITE_APPWRITE_BUCKET_ID.',
    row_invalid_structure: 'La tabla no tiene las columnas que espera la app (mira el README).',
    user_invalid_credentials: 'Email o contraseña incorrectos.',
    user_already_exists: 'Ya existe una cuenta con ese email.',
    user_unauthorized: 'No tienes permiso para hacer eso. Revisa los permisos de la tabla o del bucket.',
    storage_file_type_unsupported: 'Ese tipo de archivo no está permitido en el bucket.',
    storage_invalid_file_size: 'La foto es demasiado grande para el bucket.',
    general_rate_limit_exceeded: 'Demasiados intentos. Espera un momento.',
  }
  if (porTipo[error?.type]) return porTipo[error.type]

  // Sin respuesta del servidor: endpoint mal escrito, Appwrite apagado o bloqueo por CORS
  if (error?.message === 'Failed to fetch' || error?.name === 'TypeError') {
    return 'No hay conexión con Appwrite: revisa VITE_APPWRITE_ENDPOINT, que Appwrite esté corriendo y que la plataforma web esté registrada.'
  }
  return error?.message || 'Algo salió mal.'
}
