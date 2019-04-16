This library simplifies the bootstrapping of WebRTC overlays made with
[Simple Peers](https://github.com/feross/simple-peer) by passing all connection
requests to the same root peer, which may answer the request itself or pass the request
to another peer.  

The handshake between the requester and the answerer are performed over
WebSockets connected to the bootstrap server. After the handshake has been
performed, the websocket connections are closed to conserve resources.


# Client

## Usage

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

## API

### var bootstrap = new BootstrapClient(host, opts)

Creates a new bootstrap client that will connect to 'host'. Opts may be one of the followings:
````
{
    secure: false // if true uses 'wss://' otherwise 'ws://'
}
````

### bootstrap.root(secret, onRequest(req), cb)

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

*cb(err)* is called after either the connection to the server succeeded or failed.

### peer =  bootstrap.connect([req, opts])

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

# Server

The server can be run locally for tests or deployed on any public server
(server with a public IP address) that supports WebSockets.

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

## Usage

Command-line:

````
    # Using the configuration file
    node bin/server path_to_config.json

    # Or using environment variables
    SECRET=12345 node bin/server
````

Library:

````
    var Server = require('webrtc-bootstrap').Server
    var s = new Server('secret') 
````

## Secret configuration

Please clone this repository, copy config.example.json to config.json, and
change the secret in the config.json file to ensure only your root node can
connect as root to the bootstrap server.

## API

### Server(secret, opts)

`secret` is an alphanumeric string that is used by the client to connect as root.

`opts` is an optional object with the default values:

    {
        public: null,
        timeout: 30 * 1000 // ms,
        httpServer: null,
        port: 5000,
        seed: null
    }

`opts.public` is the path to the public directory for serving static content.

`opts.timeout` is the maximum allowed time for a candidate to successfully join the network.

`opts.httpServer` is an existing http server.

`opts.port` is the port used by the http server if none has been provided.

`opts.seed` is a number to use as a seed for the pseudo-random generation of channel ids. If null, the crypto.randomBytes method is used instead.

### Server.upgrade(path, handler)

`path` is a url ````String```` starting with a '/'

`handler` is a ````Function````, ````function handler (ws, req) { ... }````, where ````ws```` is the websocket connection that resulted from the upgrade and ````req```` is the original http request.

# Projects

This library is used by the the following
[library](https://github.com/elavoie/webrtc-tree-overlay) to organize peers in
a tree. 

Submit a pull-request to add your own!

MIT. Copyright (c) [Erick Lavoie](http://ericklavoie.com).
