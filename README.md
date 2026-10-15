# Muro en tiempo real con Appwrite

Una app chica de ejemplo para conocer **Appwrite**, una alternativa open source a Firebase. Es un muro de mensajes: cada persona se registra, publica texto con una foto opcional, y lo que publica aparece al instante en las pantallas de los demás, sin recargar.

Es la app del video y del artículo **Appwrite self-hosted con Docker**, que explican la instalación y la configuración paso a paso:

- Artículo: [en español](https://kevorojas.com/es/blog/appwrite-self-hosted-docker) · [in English](https://kevorojas.com/en/blog/appwrite-self-hosted-docker)
- Video: [https://youtu.be/8SjKCydoR6o](https://youtu.be/8SjKCydoR6o)

> Firebase es una marca de Google; este proyecto no tiene relación con Google.

En unos pocos archivos usa las cuatro piezas principales de Appwrite:

| Pieza | Para qué se usa aquí |
|---|---|
| **Auth** (`Account`) | Registro, login y logout con email y contraseña. La sesión sobrevive a un F5. |
| **Databases** (`TablesDB`) | Una tabla `mensajes`: cada mensaje es una fila. |
| **Storage** (`Storage`) | Un bucket `fotos` para las imágenes de los mensajes. |
| **Realtime** (`Realtime`) | Avisa al instante cuando alguien publica o borra un mensaje. |

Los **permisos** hacen el resto: cualquier usuario con sesión lee el muro, y solo el autor puede borrar su mensaje y su foto.

<!-- TODO: captura -->

Está hecha con React + Vite en **JavaScript** (sin TypeScript), con el SDK web oficial [`appwrite`](https://www.npmjs.com/package/appwrite) v28.

## Requisitos

- Node.js 20 o superior.
- Una instancia de Appwrite **1.9 o superior**. Probada con Appwrite **2.4.0** self-hosted con Docker; la guía oficial de instalación hoy instala la **2.5.0** (no probada con esta app). También sirve Appwrite Cloud.
- Un proyecto creado en la consola de Appwrite.

## Cómo está organizado el código

```
src/
├── lib/appwrite.js         ← todo lo que habla con Appwrite (cliente, servicios, permisos, realtime)
├── App.jsx                 ← decide si mostrar el login o el muro
├── components/Acceso.jsx   ← formulario de login y registro
├── components/Muro.jsx     ← lista de mensajes + suscripción en tiempo real
├── components/Publicar.jsx ← formulario para publicar texto y foto
└── index.css               ← estilos
```

Los componentes no importan nada de `appwrite`: solo llaman a funciones de `src/lib/appwrite.js`. Si quieres entender la integración, empieza por ese archivo.

## Qué necesita la app en Appwrite

> **El paso a paso está en el [artículo](https://kevorojas.com/es/blog/appwrite-self-hosted-docker)**: la instalación con Docker, cada pantalla de la consola, por qué los permisos van así y cómo publicarla en Sites. Aquí solo queda el resumen de lo que la app espera encontrar.

| Recurso | ID | Detalle |
|---|---|---|
| Plataforma **Web** | — | Hostname `localhost` (y el dominio del sitio, si la publicas en Sites) |
| Login | — | **Email/Password** activado |
| Base de datos | `muro` | |
| Tabla | `mensajes` | Columnas Varchar: `texto` (500, obligatoria), `autorId` (36, obligatoria), `autorNombre` (128, obligatoria), `fotoId` (36, opcional) |
| Bucket | `fotos` | Para las imágenes de los mensajes |

**Permisos, en una línea:** la tabla y el bucket dan **solo Create** a *All users*, con **Row level security** y **File level security** activados. La app le pone a cada mensaje y a cada foto lectura para los usuarios con sesión, y edición y borrado solo para el autor. El porqué está en el artículo.

## Correrlo en local

```bash
cp .env.example .env   # completa los IDs de tu proyecto
npm install
npm run dev
```

| Variable | Valor |
|---|---|
| `VITE_APPWRITE_ENDPOINT` | `http://localhost/v1` en una instalación local por defecto |
| `VITE_APPWRITE_PROJECT_ID` | **Settings** del proyecto → **Project ID** |
| `VITE_APPWRITE_DATABASE_ID` | `muro` |
| `VITE_APPWRITE_TABLE_ID` | `mensajes` |
| `VITE_APPWRITE_BUCKET_ID` | `fotos` |

Estos IDs **no son secretos**: terminan en el JavaScript que descarga el navegador. Lo que protege los datos son los permisos. El `.env` igual queda fuera de Git.

Abre `http://localhost:5173`, crea una cuenta y publica algo. Para ver el tiempo real, abre una ventana en modo incógnito con otro usuario y ponlas lado a lado.

```bash
npm run build   # versión de producción en dist/
npm run lint    # revisa el código con oxlint
```

**Publicarla en Appwrite Sites** y los **problemas comunes** (fotos que no se ven, CORS, puertos ocupados) están en el [artículo](https://kevorojas.com/es/blog/appwrite-self-hosted-docker).

## Cómo funciona por dentro

Todo está en [`src/lib/appwrite.js`](src/lib/appwrite.js):

- **Sesión:** `account.get()` al cargar. Si responde, hay sesión (Appwrite la guarda en una cookie). Registro con `account.create()` + `account.createEmailPasswordSession()`; logout con `account.deleteSession({ sessionId: 'current' })`.
- **Leer:** `tablesDB.listRows()` con `Query.orderDesc('$createdAt')` y `Query.limit(50)`. Los más nuevos van **arriba**, como en un muro o un feed: lo último que se publica aparece justo debajo del formulario, sin hacer scroll.
- **Publicar:** si hay foto, primero `storage.createFile()` y después `tablesDB.createRow()` con el `fotoId`. La fila y el archivo llevan los mismos permisos.
- **Mostrar la foto:** `storage.getFileView()` arma la URL (no hace ninguna petición). Si quisieras que Appwrite te la redimensione, cambia por `getFilePreview({ ..., width: 800 })`.
- **Borrar:** `tablesDB.deleteRow()` y, si tenía foto, `storage.deleteFile()`. Si otra persona intentara borrar tu mensaje, Appwrite lo rechazaría aunque viera el botón: el botón oculto es comodidad, la seguridad la ponen los permisos.
- **Tiempo real:** `realtime.subscribe()` al canal `tablesdb.<DATABASE_ID>.tables.<TABLE_ID>.rows` (armado con `Channel.tablesdb(...).table(...).row()`). Cada evento trae en `events` nombres como `tablesdb.muro.tables.mensajes.rows.<id>.create` o `.delete`. La suscripción se cancela al desmontar el muro (`subscription.unsubscribe()`), y al cerrar sesión se cierra el WebSocket (`realtime.disconnect()`). Appwrite solo manda eventos de filas que el usuario tiene permiso de leer.

## Licencia

[MIT](LICENSE) © Kevin Rojas · [kevorojas.com](https://kevorojas.com)
