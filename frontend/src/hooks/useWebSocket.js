/**
 * useWebSocket.js
 * Hook לחיבור Socket.IO עם reconnect אוטומטי.
 */
import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

const SOCKET_URL = `http://${window.location.hostname}:5000`

export default function useWebSocket(onMessage) {
  const socketRef        = useRef(null)
  const [connected, setConnected] = useState(false)
  const onMessageRef     = useRef(onMessage)
  onMessageRef.current   = onMessage

  const connect = () => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('connect',    () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))

    socket.on('attendance_event', (data) => {
      onMessageRef.current(data)
    })
  }

  useEffect(() => {
    connect()
    return () => {
      socketRef.current?.disconnect()
    }
  }, [])

  return connected
}
