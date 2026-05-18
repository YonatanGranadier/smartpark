/**
 * useWebSocket.js
 * Hook לחיבור WebSocket עם reconnect אוטומטי.
 */
import { useEffect, useRef, useState, useCallback } from 'react'

const WS_URL = `ws://${window.location.hostname}:8000/ws/events`
const RECONNECT_DELAY_MS = 3000

export default function useWebSocket(onMessage) {
  const wsRef            = useRef(null)
  const retryRef         = useRef(null)
  const [connected, setConnected] = useState(false)
  const onMessageRef     = useRef(onMessage)
  onMessageRef.current   = onMessage

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      clearTimeout(retryRef.current)
      // שולח heartbeat כל 20 שניות כדי לשמור על החיבור
      retryRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('ping')
      }, 20000)
    }

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        onMessageRef.current(msg)
      } catch { /* ignore non-JSON */ }
    }

    ws.onclose = () => {
      setConnected(false)
      clearInterval(retryRef.current)
      retryRef.current = setTimeout(connect, RECONNECT_DELAY_MS)
    }

    ws.onerror = () => ws.close()
  }, [])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(retryRef.current)
      clearInterval(retryRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  return connected
}
