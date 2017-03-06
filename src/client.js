var Socket = require('simple-websocket')
var SimplePeer = require('simple-peer')
var debug = require('debug')
var log = debug('webrtc-bootstrap')

function Client (host) {
  this.host = host
  this.rootSocket = null
  this.sockets = {}
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
Client.prototype.connect = function (req, opts) {
  req = req || {}
  opts = opts || {}
  opts.timeout = opts.timeout || 30 * 1000
  opts.cb = opts.cb || function (err, peer) {
    if (err) peer.emit('error', new Error('Bootstrap Timeout'))
  }
  var peerOpts = opts.peerOpts || {}

  var self = this
  var socketId = connectId++
  var log = debug('webrtc-bootstrap:connect ' + socketId)
  log('connect(' + JSON.stringify(req) + ',' + JSON.stringify(peerOpts) + ')')

  var messageNb = 0

  if (!req.origin) {
    peerOpts.initiator = true
  }

  log('creating SimplePeer(' + JSON.stringify(peerOpts) + ')')
  var peer = new SimplePeer(peerOpts)

  var signalQueue = []

  peer.on('signal', function (data) {
    var message = JSON.stringify({
      origin: null, // set by server if null
      destination: req.origin || null, // if null, then will be sent to root
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
    clearTimeout(connectionTimeout)
    socket.destroy()
    delete self.sockets[socketId]
    opts.cb(null, peer)
  })

  if (req.signal) {
    peer.signal(req.signal)
  }

  var connectionTimeout = setTimeout(function () {
    log('bootstrap timeout, closing signaling websocket connection')
    socket.destroy()
    delete self.sockets[socketId]
    opts.cb(new Error('Bootstrap timeout'), peer)
  }, opts.timeout)

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
      req.origin = req.origin || message.origin

      peer.signal(message.signal)
    })

  this.sockets[socketId] = socket

  return peer
}

Client.prototype.close = function () {
  log('closing')
  if (this.rootSocket) {
    log('closing root socket')
    this.rootSocket.destroy()
  }

  log('closing remaining sockets')
  for (var id in this.sockets) {
    log('closing socket[' + id + ']')
    this.sockets[id].destroy()
  }
}

module.exports = Client
