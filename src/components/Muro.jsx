import { useEffect, useState } from 'react'
import Publicar from './Publicar.jsx'
import {
  borrarMensaje,
  escucharMensajes,
  listarMensajes,
  mensajeDeError,
  urlDeFoto,
} from '../lib/appwrite.js'

const formatoHora = new Intl.DateTimeFormat('es', { dateStyle: 'short', timeStyle: 'short' })

export default function Muro({ usuario }) {
  const [mensajes, setMensajes] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    // 1. Carga inicial
    listarMensajes()
      .then(setMensajes)
      .catch((err) => setError(mensajeDeError(err)))

    // 2. Tiempo real: lo que publiquen o borren otros llega solo
    const dejarDeEscuchar = escucharMensajes({
      alCrear: agregar,
      alBorrar: (fila) => setMensajes((lista) => lista.filter((m) => m.$id !== fila.$id)),
    })

    // 3. Al desmontar (por ejemplo, al cerrar sesión) cancelamos la suscripción
    return dejarDeEscuchar
  }, [])

  // Agrega arriba, sin duplicar: nuestro propio mensaje llega dos veces
  // (la respuesta de createRow y el evento de Realtime)
  function agregar(fila) {
    setMensajes((lista) => (lista.some((m) => m.$id === fila.$id) ? lista : [fila, ...lista]))
  }

  async function borrar(mensaje) {
    setError('')
    try {
      await borrarMensaje(mensaje)
      setMensajes((lista) => lista.filter((m) => m.$id !== mensaje.$id))
    } catch (err) {
      setError(mensajeDeError(err))
    }
  }

  return (
    <section>
      <Publicar usuario={usuario} alPublicar={agregar} />

      {error && <div className="error">{error}</div>}
      {mensajes.length === 0 && !error && (
        <p className="tenue">Todavía no hay mensajes. ¡Escribe el primero!</p>
      )}

      <ul className="lista">
        {mensajes.map((m) => (
          <li key={m.$id} className="tarjeta mensaje">
            <div className="mensaje-cabecera">
              <strong>{m.autorNombre}</strong>
              <time className="tenue">{formatoHora.format(new Date(m.$createdAt))}</time>
              {/* Solo el autor ve el botón. Igual, quien decide es Appwrite con los permisos */}
              {m.autorId === usuario.$id && (
                <button className="boton-borrar" onClick={() => borrar(m)}>
                  Borrar
                </button>
              )}
            </div>
            <p className="mensaje-texto">{m.texto}</p>
            {m.fotoId && <img className="foto" src={urlDeFoto(m.fotoId)} alt="" loading="lazy" />}
          </li>
        ))}
      </ul>
    </section>
  )
}
