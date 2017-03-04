This library enables the bootstrapping of a WebRTC overlay made of [Simple
Peers](https://github.com/feross/simple-peer). 

The handshake between the requester and the answerer are performed over
WebSockets connected to the bootstrap server. After the handshake has been
performed the websocket connections are closed to conserve resources on the
bootstrap server.

Any potential peer connects to the bootstrap server and requests a connection.
The request is passed to the root which is then responsible for either
accepting the connection or passing it down to another peer through an already
existing connection. Any peer may fulfill the request it received by creating a
connection to the request originator through the bootstrap server.


# Usage

    // On the root process

    var bootstrap = require('webrtc-tree-overlay-bootstrap')('bootstrap-server hostname or ip address')
    var newcomers = {}

    // Register to obtain requests
    bootstrap.root('secret', function (req) {
      console.log('root received: ' + JSON.stringify(req))

      // Remember previously created peers to route multiple
      // WebRTC handshake signals generated by the ICE Trickle
      // protocol to the same peer
      if (!newcomers[req.origin]) {
        console.log('Creating connection to signaling peer')
        newcomers[req.origin] = bootstrap.connect(req.origin)
      }

      newcomers[req.origin].signal(req.signal)
    })

    // From a different process

    var bootstrap = require('webrtc-tree-overlay-bootstrap')('bootstrap-server hostname or ip address')
    var p = bootstrap.connect()
    p.on('connect', function () { /* ready to use */ })

# Bootstrap client

Enables establishing WebRTC connections between peers.

## bootstrap.root(secret, onRequest(req))

*secret* is an alphanumeric string that has been set up during the server
configuration (see below in the server configuration). It ensures only the 
the authorized root will receive requests.

*onRequest(req)* is a callback that will be called with a request object,
itself with the following properties:
  - `req.origin`: the identifier of the originator of the request
    (automatically created by the bootstrap server)
  - `req.signal`: the SimplePeer signal to establish the WebRTC connection.
    Because of the ICE trickle protocol for signaling, the same peer may
    trigger multiple calls to *onRequest* (unless
    `peerOpts.tricke: false`). It is the responsibility of the root
    node to ensure all the requests will be routed to the same peer.

## peer =  bootstrap.connect([destination, peerOpts])

*destination* is the identifier of the peer we want to connect to. If it is
`undefined` or `falsy`, `initiator: true` will be set on *peerOpts* and the
requests will go to the root. Otherwise, if *destination* is set to
`req.origin`, then a connection will be established with the originator.

*peerOpts* will be passed to the [SimplePeer](https://github.com/feross/simple-peer) constructor.

Returns *peer*, a [SimplePeer](https://github.com/feross/simple-peer) instance.

After a connect call if the connection succeeds, *peer* will emit the usual 'connect' event. 
Two new events are added compared to the basic Simple Peer:
  1. If the connection fails, *peer* will emit a 'Bootstrap timeout' error.
  2. During the handshake protocol, *peer* emits the 'identifier' event with
     the id it has been assigned by the bootstrap server.

# Bootstrap server

The server can be run locally for tests or deployed on any public server (server with a public IP
address) that supports WebSockets to create overlays on the Internet.

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

## Usage

    # Using the configuration file
    node bin/server path_to_config.json

    # Or using environment variables
    SECRET=12345 node bin/server

## Secret configuration

Please clone this repository, copy config.example.json to config.json, and
change the secret in the config.json file to ensure only your root node can
connect as root to the bootstrap server.

# Projects

This library is used by the the following
[library](https://github.com/elavoie/webrtc-tree-overlay) to organize peers in
a tree. 

Submit a pull-request to add your own!

