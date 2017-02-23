var Socket = require('simple-websocket')
var SimplePeer = require('simple-peer')
var debug = require('debug')
var log = debug('webrtc-tree-overlay-signaling:Client')

function Client (host) {
  this.host = host
  this.rootSocket = null
  this.socket = null
}

Client.prototype.root = function (secret, onRequest) {
  log('root(' + secret + ')')
  this.rootSocket = new Socket('ws://' + this.host + '/' + secret)
    .on('connect', function () {
      log('root(' + secret + ') connected')
    })
    .on('data', function (data) {
      log('root(' + secret + ') offer received')
      onRequest(JSON.parse(data))
    })
    .on('close', function () {
      log('root(' + secret + ') closing')
    })
    .on('error', function (err) {
      log('root(' + secret + ') error')
      throw err
    })
}

Client.prototype.connect = function (peer, destination) {
  log('connect(' + peer + ',' + destination + ')')

  if (!(peer instanceof SimplePeer)) {
    throw new Error('Invalid peer, should be an instance of SimplePeer (simple-peer)')
  }

  var success = false
  var socket = new Socket('ws://' + this.host + '/join')
    .on('connect', function () {
      log('signaling websocket connected, sending request')
      peer.on('signal', function (data) {
        log('connect() signal received: ' + data)
        socket.send(JSON.stringify({
          origin: null, // set by server if null
          destination: destination || null, // if null, then will be sent to root
          signal: data
        }))
      })
      peer.once('connect', function () {
        log('bootstrap succeeded, closing signaling websocket connection')
        success = true
        socket.destroy()
      })
      setTimeout(function () {
        if (!success) {
          log('bootstrap timeout, closing signaling websocket connection')
          socket.destroy()
          peer.emit('error', new Error('Bootstrap timeout'))
        }
      }, 30 * 1000)
    })
    .on('data', function (data) {
      log('connect() data received: ' + data)
      var message = JSON.parse(data)
      // Optimization to send the subsequent ICE
      // messages directly rather than through the tree
      // overlay: our next signals will go directly
      // to the destination through the bootstrap server
      destination = destination || message.origin

      // message.destination is our id
      peer.emit('identifier', message.destination)

      peer.signal(message.signal)
    })

  return peer
}

module.exports = Client