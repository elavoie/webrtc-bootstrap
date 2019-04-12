var Socket = require('simple-websocket')
var SimplePeer = require('simple-peer')
var debug = require('debug')
var log = debug('webrtc-bootstrap')

var HEARTBEAT_INTERVAL = 10000 // ms

function Client (host, opts) {
  if (!(this instanceof Client)) {
    throw new Error('Function must be called as a constructor')
  }
  if (typeof opts === 'undefined') {
    opts = {}
  }
  opts.secure = opts.secure || false

  this.secure = opts.secure
  this.host = host
  this.rootSocket = null
  this.sockets = {}
}

Client.prototype.root = function (secret, onRequest, cb) {
  log('root(' + secret + ')')
  var protocol = this.secure ? 'wss://' : 'ws://'
  var url = protocol + this.host + '/' + secret + '/webrtc-bootstrap-root'

  var interval = null

  this.rootSocket = new Socket(url)
    .on('connect', function () {
      log('root(' + secret + ') connected')
      if (cb) return cb()
    })
    .on('data', function (data) {
      var msg = JSON.parse(data)
      if (msg === 'heartbeat') { 
        log('root(' + secret + ') heartbeat') 
      } else {
        log('root(' + secret + ') offer received')
        onRequest(msg)
      }
    })
    .on('close', function () {
      log('root(' + secret + ') closing')
      clearInterval(interval)
    })
    .on('error', function (err) {
      log('root(' + secret + ') error')
      clearInterval(interval)
      if (cb) { return cb(err) }
    })
    .on('open', function () {
      interval = setInterval(function () {
        this.rootSocket.send('heartbeat')  
      }, HEARTBEAT_INTERVAL)
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
  log('connect(' + JSON.stringify(req) + ',' + peerOpts.toString() + ')')
  log('peerOpts:')
  log(peerOpts)

  var messageNb = 0

  if (!req.origin) {
    var peerOptsCopy = {}
    for (var p in peerOpts) {
      peerOptsCopy[p] = peerOpts[p]
    }
    peerOptsCopy.initiator = true
  } else {
    peerOptsCopy = peerOpts
  }

  log('creating SimplePeer() with opts:')
  log(JSON.stringify(peerOptsCopy))
  var peer = new SimplePeer(peerOptsCopy)

  var signalQueue = []

  peer.on('signal', function (data) {
    var message = JSON.stringify({
      origin: null, // set by server if null
      destination: req.origin || null, // if null, then will be sent to root
      signal: data,
      rank: messageNb++
    })
    if (!socketConnected) {
      log('connect() queuing message with signal:')
      log(message)
      signalQueue.push(message)
    } else {
      log('connect() sending message with signal:')
      log(message)
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
  var protocol = this.secure ? 'wss://' : 'ws://'
  var socket = new Socket(protocol + this.host + '/join')
    .on('connect', function () {
      socketConnected = true
      log('signaling websocket connected')

      if (signalQueue.length > 0) {
        var queue = signalQueue.slice(0)
        signalQueue = []
        for (var i = 0; i < queue.length; ++i) {
          log('sending queued signal ' + (i+1) + '/' + queue.length)
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

      // Extract our own id from the correspondance
      socket.id = message.destination

      peer.signal(message.signal)
    })
    .on('error', function (err) {
      log('error()')
      log(err)
      opts.cb(err)
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
