import { useState } from 'react'
import { iniciarSesion, mensajeDeError, registrarse } from '../lib/appwrite.js'

// Formulario de login y registro (email + contraseña)
export default function Acceso({ alEntrar }) {
  const [modo, setModo] = useState('login') // 'login' o 'registro'
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const esRegistro = modo === 'registro'

  async function enviar(e) {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      const usuario = esRegistro
        ? await registrarse(nombre, email, password)
        : await iniciarSesion(email, password)
      alEntrar(usuario)
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form className="tarjeta formulario" onSubmit={enviar}>
      <h2>{esRegistro ? 'Crear cuenta' : 'Iniciar sesión'}</h2>

      {esRegistro && (
        <label>
          Nombre
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        </label>
      )}
      <label>
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label>
        Contraseña
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
      </label>

      {error && <div className="error">{error}</div>}

      <button className="boton" disabled={enviando}>
        {enviando ? 'Un momento…' : esRegistro ? 'Crear cuenta' : 'Entrar'}
      </button>

      <button
        type="button"
        className="enlace"
        onClick={() => {
          setModo(esRegistro ? 'login' : 'registro')
          setError('')
        }}
      >
        {esRegistro ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
      </button>
    </form>
  )
}
