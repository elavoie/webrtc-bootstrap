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

var connectId = 0
Client.prototype.connect = function (peerOpts, destination) {
  peerOpts = peerOpts || {}

  var log = debug('webrtc-tree-overlay-signaling:connect ' + connectId++)
  log('connect(' + peerOpts + ',' + destination + ')')

  var messageNb = 0

  if (!destination) {
    peerOpts.initiator = true
  }

  var peer = new SimplePeer(peerOpts)

  var signalQueue = []

  peer.on('signal', function (data) {
    var message = JSON.stringify({
      origin: null, // set by server if null
      destination: destination || null, // if null, then will be sent to root
      signal: data,
      rank: messageNb++
    })
    log('connect() sending message with signal:')
    log(message)
    if (!socketConnected) {
      signalQueue.push(message)
    } else {
      socket.send(message)
    }
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
  }, 60 * 1000)

  var success = false
  var socketConnected = false
  var socket = new Socket('ws://' + this.host + '/join')
    .on('connect', function () {
      socketConnected = true
      log('signaling websocket connected')

      if (signalQueue.length > 0) {
        var queue = signalQueue.slice(0)
        signalQueue = []
        for (var i = 0; i < queue.length; ++i) {
          socket.send(queue[i])
        }
      }
    })
    .on('data', function (data) {
      log('connect() signal received:')
      log(data.toString())
      var message = JSON.parse(data.toString())
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
