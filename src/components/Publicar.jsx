import { useState } from 'react'
import { mensajeDeError, publicarMensaje } from '../lib/appwrite.js'

const TAMANO_MAXIMO = 5 * 1024 * 1024 // 5 MB, el mismo límite que pusimos en el bucket

export default function Publicar({ usuario, alPublicar }) {
  const [texto, setTexto] = useState('')
  const [foto, setFoto] = useState(null)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  function elegirFoto(e) {
    const archivo = e.target.files[0]
    setError('')
    if (archivo && archivo.size > TAMANO_MAXIMO) {
      setError('La foto pesa más de 5 MB.')
      e.target.value = ''
      return
    }
    setFoto(archivo ?? null)
  }

  async function enviar(e) {
    e.preventDefault()
    if (!texto.trim()) return
    setError('')
    setEnviando(true)
    try {
      const fila = await publicarMensaje(usuario, texto.trim(), foto)
      alPublicar(fila)
      setTexto('')
      setFoto(null)
      e.target.reset() // limpia el input de archivo
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form className="tarjeta publicar" onSubmit={enviar}>
      <textarea
        placeholder="¿Qué quieres compartir?"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        maxLength={500}
        rows={3}
        required
      />
      <div className="publicar-acciones">
        <label className="boton-secundario">
          {foto ? `Foto: ${foto.name}` : 'Agregar foto'}
          <input type="file" accept="image/*" onChange={elegirFoto} hidden />
        </label>
        <span className="tenue">{texto.length}/500</span>
        <button className="boton" disabled={enviando || !texto.trim()}>
          {enviando ? 'Publicando…' : 'Publicar'}
        </button>
      </div>
      {error && <div className="error">{error}</div>}
    </form>
  )
}
