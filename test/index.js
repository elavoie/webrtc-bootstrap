var tape = require('tape')
var wrtc = require('wrtc')
var debug = require('debug')
var log = debug('test')
var Server = require('..').Server
var Client = require('../')

var secret = 'secret'
var port = 5000

tape('Basic startup shutdown tests', function (t) {
  var server = new Server(secret, { port: port })
  t.ok(server)
  var bootstrap = new Client('localhost:' + port)
  t.ok(bootstrap)

  bootstrap.close()
  server.close()
  t.end()
})

tape('Root request on connection', function (t) {
  var server = new Server(secret, { port: port, timeout: 5 * 1000 })
  t.ok(server)
  var bootstrap = new Client('localhost:' + port)
  t.ok(bootstrap)

  log('registering root')
  var requestNb = 0
  bootstrap.root(secret, function (req) {
    log('received request (' + requestNb++ + '): ' + JSON.stringify(req))
    t.ok(req)
    t.ok(req.origin)
    t.ok(req.signal)
  })

  var p = bootstrap.connect(null, {
    peerOpts: { wrtc: wrtc },
    timeout: 3 * 1000,
    cb: function (err, peer) {
      t.equal(err.message, 'Bootstrap timeout')
      bootstrap.close()
      server.close()
      p.destroy()
      t.end()
    }
  })
})

tape('README example', function (t) {
  var server = new Server(secret)
  t.ok(server)

  var bootstrap = new Client('localhost:' + port)
  t.ok(bootstrap)
  var newcomers = {}

  bootstrap.root(secret, function (req) {
    log('root received: ' + JSON.stringify(req))

    if (!newcomers[req.origin]) {
      log('Creating connection to signaling peer')
      newcomers[req.origin] = bootstrap.connect(req, {
        peerOpts: { wrtc: wrtc }
      })
      newcomers[req.origin].on('data', function (data) {
        log(data)
        t.equal(data.toString(), 'ping')
        newcomers[req.origin].send('pong')
      })
    } else {
      log('Passing the signal data')
      newcomers[req.origin].signal(req.signal)
    }
  })

  // From a different process
  var p = bootstrap.connect(null, {
    peerOpts: {
      wrtc: wrtc
    }
  })
  p.on('connect', function () { p.send('ping') })
  p.on('data', function (data) {
    log(data)
    t.equal(data.toString(), 'pong')
    p.destroy()
    bootstrap.close()
    server.close()
    t.end()
  })
})
