import { http, HttpResponse } from 'msw'

export const defaultHandlers = [
  http.get('http://hs.example.com/version', () => {
    return HttpResponse.json({ version: '0.29.3', commit: 'abc' })
  }),
  http.get('http://hs.example.com/api/v1/health', () => {
    return HttpResponse.json({ databaseConnectivity: true })
  }),
  http.get('http://hs.example.com/api/v1/user', () => {
    return HttpResponse.json({ users: [] })
  }),
]
