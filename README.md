[![Build Status](https://travis-ci.org/elavoie/webrtc-bootstrap.svg?branch=master)](https://travis-ci.org/elavoie/webrtc-bootstrap)

This library simplifies the bootstrapping of WebRTC connections made with
[Simple Peers](https://github.com/feross/simple-peer) by passing all connection
requests to the same root peer.  This the client library for the
[webrtc-bootstrap-server](https://github.com/elavoie/webrtc-bootstrap-server).

Any potential peer connects to the bootstrap server with the bootstrap client and requests a connection.
The request is passed to the root which is then responsible for either
accepting the connection or passing it down to another peer through an already
existing connection. Any peer may answer the request by creating a
connection to the request originator.


The handshake between the requester and the answerer are performed over
WebSockets connected to the bootstrap server. After the handshake has been
performed, the websocket connections are closed to conserve resources.


# Usage

    // On the root process

    var bootstrap = require('webrtc-bootstrap')('bootstrap-server hostname or ip-address:port')
    var newcomers = {}

    // Register to obtain requests
    bootstrap.root('secret', function (req) {
      console.log('root received: ' + JSON.stringify(req))

      // Remember previously created peers.  
      // This way we can route multiple WebRTC handshake signals generated 
      // by the ICE Trickle protocol to the same peer
      if (!newcomers[req.origin]) {
        console.log('Creating connection to signaling peer')
        newcomers[req.origin] = bootstrap.connect(req)
        newcomers[req.origin].on('data', function (data) {
          console.log(data)
          newcomers[req.origin].send('pong')
        })
      } else {
        console.log('Passing the signal data')
        newcomers[req.origin].signal(req.signal)
      }
    })

    // From a different process

    var bootstrap = ...
    var p = bootstrap.connect()
    p.on('connect', function () { p.send('ping') })
    p.on('data', function (data) {
      console.log(data)
    })

# Bootstrap client

## bootstrap.root(secret, onRequest(req))

*secret* is an alphanumeric string that has been set up during the server
configuration (see
[webrtc-bootstrap-server](https://github.com/elavoie/webrtc-bootstrap-server)).
It becomes a route for the root WebSocket connection. It ensures only the the
authorized root will receive requests.

*onRequest(req)* is a callback that will be called with a request object,
itself with the following properties:
  - `req.origin`: the identifier of the originator of the request
    (automatically created by the bootstrap server)
  - `req.signal`: the SimplePeer signal to establish the WebRTC connection.
    Because of the ICE trickle protocol for signaling, the same peer may
    trigger multiple calls to *onRequest* (unless `peerOpts.tricke: false`). 
    All following requests should be routed to the same peer with `peer.signal(req.signal)`.

## peer =  bootstrap.connect([req, opts])

*req* is an optional request object (see `bootstrap.root`).  If it is `undefined` or
`falsy`, `initiator: true` will be set on *peerOpts* to initiate the signaling
protocol. All the requests will go to the root. Otherwise, if a valid *req* is
used, then a WebSocket connection will be established with the originator
(`req.origin`) through the bootstrap server to answer the signaling offer and
finish the handshake. 

*opts* are further options:

`opts.peerOpts` are options to be passed to the [SimplePeer](https://github.com/feross/simple-peer) constructor. Defaults to `{}`.

`opts.cb(err, peer)` is an optional callback to handle bootstrapping errors.

Returns *peer*, a [SimplePeer](https://github.com/feross/simple-peer) instance.

After a connect call if the connection succeeds, *peer* will emit the usual 'connect' event. 

# Projects

This library is used by the the following
[library](https://github.com/elavoie/webrtc-tree-overlay) to organize peers in
a tree. 

Submit a pull-request to add your own!

MIT. Copyright (c) [Erick Lavoie](http://ericklavoie.com).
