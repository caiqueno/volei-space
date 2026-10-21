// Service worker do volei.space (R18): recebe o "toque" de push SEM conteúdo e mostra um texto fixo.
// Nada de dado pessoal passa pelo serviço de push; ao tocar, abre a central de notificações.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (evento) => evento.waitUntil(self.clients.claim()))

self.addEventListener('push', (evento) => {
  evento.waitUntil(
    self.registration.showNotification('Você tem novidades no volei.space', {
      body: 'Toque para ver.',
      tag: 'volei-space-novidades',
      data: { url: '/meu-time/notificacoes' },
    }),
  )
})

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const destino = (evento.notification.data && evento.notification.data.url) || '/meu-time/notificacoes'
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const janela of janelas) {
        if (janela.url.indexOf(destino) !== -1 && 'focus' in janela) return janela.focus()
      }
      return self.clients.openWindow(destino)
    }),
  )
})
