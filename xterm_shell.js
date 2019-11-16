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
    var path = require('path');
    const fs = require('fs');
    
    // -------------------------------------------------------------------------------------------------
    // Determining the path to the files in the dependent xterm module once.
    // See https://discourse.nodered.org/t/use-files-from-dependent-npm-module/17978/5?u=bartbutenaers
    // -------------------------------------------------------------------------------------------------
    var xtermPath = require.resolve("xterm");
    xtermPath = xtermPath.substring(0, xtermPath.indexOf("xterm") + 5);
    
    var xtermJsPath = path.join(xtermPath, 'lib', 'xterm.js');
    if (!fs.existsSync(xtermJsPath)) {
        console.log("Javascript file " + xtermJsPath + " does not exist");
        xtermJsPath = null;
    }
    
    var xtermCssPath = path.join(xtermPath, 'css', 'xterm.css');
    if (!fs.existsSync(xtermCssPath)) {
        console.log("Css file " + xtermCssPath + " does not exist");
        xtermCssPath = null;
    }      
    
    // -------------------------------------------------------------------------------------------------
    // Determining the path to the files in the dependent xterm-addon-fi module once.
    // -------------------------------------------------------------------------------------------------
    var xtermFitPath = require.resolve("xterm-addon-fit");
    xtermFitPath = xtermFitPath.substring(0, xtermFitPath.indexOf("xterm-addon-fit") + 15);
    
    var xtermFitJsPath = path.join(xtermFitPath, 'lib', 'xterm-addon-fit.js');
    if (!fs.existsSync(xtermFitJsPath)) {
        console.log("Javascript file " + xtermFitJsPath + " does not exist");
        xtermFitJsPath = null;
    }

    function XtermShellNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.rows = config.rows;
        node.columns = config.columns;
        node.useBinaryTransport = os.platform() !== "win32";
        node.ptyProcesses = new Map();
        
        // TODO met de options zou je node config kunnen overwriten (bv als gebruiker rows verandert en dadelijk zonder deploy resultaat wil zien)
        node.startTerminal = function(terminalId) {
            // When the previous ptyProcess was still running, we will stop it.
            if (node.ptyProcesses.has(terminalId)) {
                console.log("Previous ptyProcess was already started");
                node.stopTerminal(terminalId);
            }
            
            try {
                const env = Object.assign({}, process.env);
                env['COLORTERM'] = 'truecolor';
            
                var rows = parseInt(node.rows);
                var cols = parseInt(node.columns);
                
                var ptyProcess = pty.spawn(process.platform === 'win32' ? 'cmd.exe' : 'bash', [], {
                  name: 'xterm-256color',
                  cols: cols || 80,
                  rows: rows || 24,
                  cwd: env.PWD,
                  env: env,
                  encoding: node.useBinaryTransport ? null : 'utf8'
                });
                
                node.ptyProcesses.set(terminalId, ptyProcess);
            
                //TODO Send PID to show in config screen ???????? res.send(term.pid.toString());
        
                ptyProcess.on('data', function(data) {
                    try {
                        console.log("data send via websocket to client");
                        //TODO send data in output message ???? node.send(data);
                        
                        // Convert the terminal data to base64, before sending it to the client
                        var buff = new Buffer(data);
                        var base64Data = buff.toString('base64');
                        RED.comms.publish("xterm_shell", JSON.stringify( { nodeId: node.id, terminalId: terminalId, data: base64Data } ));
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
        
        node.writeDataToTerminal = function(terminalId, data) {
            try {
                var ptyProcess = node.ptyProcesses.get(terminalId);
                ptyProcess.write(data);
            }
            catch (err) {
                node.error(err);
                // TODO socket.emit('data', '\r\n*** SSH CONNECTION ERROR: ' + err.message + ' ***\r\n');
            }  
        }
        
        node.stopTerminal = function(terminalId) {  
            var ptyProcess = node.ptyProcesses.get(terminalId);
            
            if (!ptyProcess) {
                return;
            }
            
            try {
                ptyProcess.kill();
                node.ptyProcesses.delete(terminalId);
                
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
            
            var terminalIds = Array.from(node.ptyProcesses.keys());
            
            // Stop all the spawned pty processes
            for (var i = 0; i < terminalIds.length; i++) {
                var terminalId = terminalIds[i];
                node.stopTerminal(terminalId);
            }
            
            if (done) {
                done();
            }
        });
    }

    RED.nodes.registerType("xterm_shell", XtermShellNode);
    
    // Process the requests from the flow editor
    RED.httpAdmin.get('/xterm_shell/:node_id/:terminal_id/:command/:info', function(req, res) {
        var xtermShellNode;
        
        if (req.params.command !== "js" && req.params.command !== "css") {
            // There might be N different xterm shell nodes active, each with their own terminal.  So get the right one ...
            xtermShellNode = RED.nodes.getNode(req.params.node_id);
            
            if (!xtermShellNode) {
                res.status(404).json('Cannot find node with id = ' + req.params.node_id);
            }
        }     

        switch (req.params.command) {
            case "js":
                switch (req.params.info) {
                    case "xterm.js":
                        if (xtermJsPath) {
                            // Send the requested .js file to the client (info contains .js file name)
                            res.sendFile(xtermJsPath);
                        }
                        else {
                            res.status(404).json('Javascript terminal library is not available');
                        }
                        break;
                    case "xterm-addon-fit.js":
                        if (xtermFitJsPath) {
                            // Send the requested .js file to the client (info contains .js file name)
                            res.sendFile(xtermFitJsPath);
                        }
                        else {
                            res.status(404).json('Javascript terminal fit addon is not available');
                        }
                        break;    
                    default:
                        console.log("Unknown javascript file '" + req.params.info + "'");
                        res.status(404).json('Unknown javascript file');                        
                }
                break;
            case "css":
                if (xtermCssPath) {
                    // Send the requested .css file to the client (info contains .css file name)
                    res.sendFile(xtermCssPath);
                }
                else {
                    res.status(404).json('Css file does not exist');
                }
                break;
            case "start":
                xtermShellNode.startTerminal(req.params.terminal_id);
                res.status(200).json('success');
                break;
            case "stop":
                xtermShellNode.stopTerminal(req.params.terminal_id);
                res.status(200).json('success');
                break;
            case "write":        
                var base64Decoded = new Buffer(req.params.info, 'base64').toString('ascii');
                // Process the command line data (info contains command line input)
                xtermShellNode.writeDataToTerminal(req.params.terminal_id, base64Decoded);
                res.status(200).json('success');
                break;
            default:
                console.log("Unknown category '" + category + "'");
                res.status(404).json('Unknown category');
        }
    });
}
