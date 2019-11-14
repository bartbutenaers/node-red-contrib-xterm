/**
 * Copyright 2019 Bart Butenaers
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function(RED) {
    var settings = RED.settings;
    var os = require('os');
    var pty = require('node-pty');
    var process = require('process');

    function XtermShellNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.rows = config.rows;
        node.columns = config.columns;
        node.useBinaryTransport = os.platform() !== "win32";
        
        // TODO met de options zou je node config kunnen overwriten (bv als gebruiker rows verandert en dadelijk zonder deploy resultaat wil zien)
        node.startTerminal = function(options) {
            // When the previous ptyProcess was still running, we will stop it.
            if (node.ptyProcess) {
                console.log("Previous ptyProcess was already started");
                node.stopTerminal();
            }
            
            try {
                const env = Object.assign({}, process.env);
                env['COLORTERM'] = 'truecolor';
            
                var rows = parseInt(node.rows);
                var cols = parseInt(node.columns);
                
                node.ptyProcess = pty.spawn(process.platform === 'win32' ? 'cmd.exe' : 'bash', [], {
                  name: 'xterm-256color',
                  cols: cols || 80,
                  rows: rows || 24,
                  cwd: env.PWD,
                  env: env,
                  encoding: node.useBinaryTransport ? null : 'utf8'
                });
            
                //TODO Send PID to show in config screen ???????? res.send(term.pid.toString());
        
                node.ptyProcess.on('data', function(data) {
                    try {
                        console.log("data send via websocket to client");
                        //TODO send data in output message ???? node.send(data);
                        
                        // Convert the terminal data to base64, before sending it to the client
						var buff = new Buffer(data);
						var base64Data = buff.toString('base64');

                        RED.comms.publish("xterm_shell", { id: node.id, data: base64Data });
                    } 
					catch (ex) {
                        // The WebSocket is not open, ignore
                    }
                });
                
                console.log("Pty process started");
            }
            catch (err) {
                node.error(err);
                // TODO socket.emit('data', '\r\n*** SSH CONNECTION ERROR: ' + err.message + ' ***\r\n');
            }
        }
        
        node.writeDataToTerminal = function(data) {
            try {
                node.ptyProcess.write(data);
                
            }
            catch (err) {
                node.error(err);
                // TODO socket.emit('data', '\r\n*** SSH CONNECTION ERROR: ' + err.message + ' ***\r\n');
            }  
        }
        
        node.stopTerminal = function() {      
            if (!node.ptyProcess) {
                return;
            }
            
            try {
                // TODO een iets elegantere manier zoeken ...
                node.ptyProcess.kill();
                node.ptyProcess = null;
                
                console.log("Pty process stopped");
            }
            catch (err) {
                node.error(err);
                // TODO socket.emit('data', '\r\n*** SSH CONNECTION ERROR: ' + err.message + ' ***\r\n');
            }
        }
        
        node.on("input", function(msg) {
            
        });

        node.on("close", function() {
            //TODO socket.emit('data', '\r\n*** SSH CONNECTION CLOSED ***\r\n');

            node.stopTerminal({});
            
            if (done) {
                done();
            }
        });
    }

    RED.nodes.registerType("xterm_shell", XtermShellNode);
    
    // Process the requests from the flow editor
    RED.httpAdmin.get('/xterm_shell/:config_node_id/:command/:info', function(req, res) {
        var xtermShellNode;
        
        if (req.params.command !== "js" && req.params.command !== "css") {
            // There might be N different xterm shell nodes active, each with their own terminal.  So get the right one ...
            xtermShellNode = RED.nodes.getNode(req.params.config_node_id);
        }     
        // TODO fout geven als xtermShellNode null is
        
        switch (req.params.command) {
            case "js":
                // TODO kunnen we zomaar files uit een andere npm module halen (die als dependency staat) ???
                var options = {
                    root: "/home/pi/.node-red/node_modules/xterm/lib",
                    dotfiles: 'deny'
                };
        
                // Send the requested .js file to the client (info contains .js file name)
                res.sendFile(req.params.info, options);
                break;
            case "css":
                var options = {
                    root: "/home/pi/.node-red/node_modules/xterm/css",
                    dotfiles: 'deny'
                };
       
                // Send the requested .css file to the client (info contains .css file name)
                res.sendFile(req.params.info, options);
                break;
            case "start":
                xtermShellNode.startTerminal({});
                res.status(200).json('success');
                break;
            case "stop":
                xtermShellNode.stopTerminal();
                res.status(200).json('success');
                break;
            case "write":        
				var base64Decoded = new Buffer(req.params.info, 'base64').toString('ascii');
                // Process the command line data (info contains command line input)
                xtermShellNode.writeDataToTerminal(base64Decoded);
                res.status(200).json('success');
                break;
            default:
                console.log("Unknown category '" + category + "'");
                res.status(404).json('Unknown category');
        }
    });
}
