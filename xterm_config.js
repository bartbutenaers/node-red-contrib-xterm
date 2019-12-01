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
 module.exports = function (RED) {
    var os = require('os');
    var pty = require('node-pty-prebuilt-multiarch');
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
	
	var xtermUseBinaryTransport = os.platform() !== "win32";
	
	// Keep the pty processes in a global map, instead of inside the Xterm configuration node.
	// Indeed the user might remove that configuration node behind our back, so we would loose all current pseudo terminal processes.
	var xtermProcessInfoMap = new Map();
	
	// Cache the reference to the xterm config node, so we don't need to search it every time
	var xtermShellNode = null;
	
	// Start or restart the timer of a terminal id
	function startTimer(terminalId, loggingEnabled) {
		var processInfo = xtermProcessInfoMap.get(terminalId);
		
		// Heartbeats are only relevant for active processes: if a process doesn't exist yet or doesn't exist anymore, then
		// we can ignore the heartbeat temparily ...
		if (processInfo) {
			// If a previous timer is still running, let's stop it ...
			if (processInfo.timerId) {
				clearInterval(processInfo.timerId);
				processInfo.timerId = null;
			}
			
			// We will get a heartbeat from the client every 5 seconds.  When we haven't received that heartbeat within 10 seconds, we assume 
			// that the client has disconnected.  In that case the pseudo terminal of that client will be stopped...
			processInfo.timerId	= setInterval(function() {
				stopTerminal(terminalId, "by heartbeat", loggingEnabled);
			}, 10000);
		}
	}

	function stopTerminal(terminalId, reason, loggingEnabled) {  
		var processInfo = xtermProcessInfoMap.get(terminalId);
		
		if (processInfo) {		
			try {
				processInfo.ptyProcess.kill();
				
				if (processInfo.timerId) {
					clearInterval(processInfo.timerId);
				}
				
				xtermProcessInfoMap.delete(terminalId);
				
				// Let the client know that the pseudo terminal has been stopped, in case the client isn't disconnected 
				// (but the heartbeat didn't arrive in time)
				RED.comms.publish("xterm_shell", JSON.stringify( { terminalId: terminalId, content: "Pseudo terminal has been stopped", type: "info" } ));
			}
			catch (err) {
				RED.comms.publish("xterm_shell", JSON.stringify( { terminalId: terminalId, content: "Cannot stop pseudoterminal: " + err, type: "error" } ));
			}
		}
	}
	
	function startTerminal(terminalId, rows, columns, loggingEnabled) {
		// When the previous ptyProcess was still running, we will stop it.
		if (xtermProcessInfoMap.has(terminalId)) {
			console.log("Previous ptyProcess was already started");
			stopTerminal(terminalId, "by restart", loggingEnabled);
		}
		
		try {
			const env = Object.assign({}, process.env);
			env['COLORTERM'] = 'truecolor';
		
			rows = parseInt(rows);
			cols = parseInt(columns);
			
			// Create a child process of the current (Node-RED) process
			var ptyProcess = pty.spawn(process.platform === 'win32' ? 'cmd.exe' : 'bash', [], {
			  name: 'xterm-256color',
			  cols: cols || 80,
			  rows: rows || 24,
			  cwd: env.PWD,
			  env: env,
			  encoding: xtermUseBinaryTransport ? null : 'utf8'
			});
			
			ptyProcess.on('data', function(data) {
				try {
					//TODO send data in output message ???? node.send(data);
					
					// Uncomment this code in case of severe problems on some systems ...
					// var dataType = Object.prototype.toString.call(data);
					// console.log("Terminal data to client (type = " + dataType + "): " + data);
					
					// Convert the terminal data to base64, before sending it to the client
					var buff = new Buffer(data);
					var base64Data = buff.toString('base64');
					RED.comms.publish("xterm_shell", JSON.stringify( { terminalId: terminalId, content: base64Data, type: "data" } ));
				} 
				catch (ex) {
					// The WebSocket is not open, ignore
				}
			});

			RED.comms.publish("xterm_shell", JSON.stringify( { terminalId: terminalId, content: "Pseudo terminal has been started (pid = " + ptyProcess.pid + ")", type: "info" } ));
			
			xtermProcessInfoMap.set(terminalId, {ptyProcess: ptyProcess});
			
			// From here on the heartbeats need to be monitored
			startTimer(terminalId);
		}
		catch (err) {
			RED.comms.publish("xterm_shell", JSON.stringify( { terminalId: terminalId, content: "Cannot start pseudoterminal: " + err, type: "error" } ));
		}
    }
        
    function writeDataToTerminal(terminalId, data, loggingEnabled) {
		try {
			var processInfo = xtermProcessInfoMap.get(terminalId);
			processInfo.ptyProcess.write(data);
			
			if (loggingEnabled) {
				var dataType = Object.prototype.toString.call(data);
				console.log("Terminal data from client (type = " + dataType + "): " + data);
			}
		}
		catch (err) {
			RED.comms.publish("xterm_shell", JSON.stringify( { terminalId: terminalId, content: "Cannot write date to pseudoterminal: " + err, type: "error" } ));
		}  
	}
        
    function XtermConfigurationNode (config) {
        RED.nodes.createNode(this, config)
		// Remark: we only store here the server-relevant settings (not the xterm.js terminal settings)
        this.rows = config.rows;
        this.columns = config.columns;
		
		// Cache the reference to this node
		xtermShellNode = this;

        this.on("close", function() {
            // Remove the reference to this node
			xtermShellNode = null;
            
            if (done) {
                done();
            }
        });
    }
    
    RED.nodes.registerType('xterm_config', XtermConfigurationNode);

	// Process the requests from the flow editor
    RED.httpAdmin.get('/xterm_shell/:terminal_id/:command/:info', function(req, res) {
		// When a config node is available on the server side, we see whether logging should be enabled
		var loggingEnabled = xtermShellNode && xtermShellNode.loggingEnabled;

        switch (req.params.command) {
            case "static":
				var filePath;
				
                switch (req.params.info) {
                    case "xterm.js":
						filePath = xtermJsPath;
                        break;
                    case "xterm-addon-fit.js":
						filePath = xtermFitJsPath;
                        break;   
					case "xterm.css":
						filePath = xtermCssPath;
						break;
					case "sidebar.html":
						filePath = path.join(__dirname, req.params.info);
						break;						
                    default:
						break;
				}
				
				if (filePath) {
					// Send the requested static file to the client
                    res.sendFile(filePath);
				}
				else {
					// Don't log because xterm also tries to load some mapping files, which are required to
					// do source mapping from Javascript to the original Typescript code.  But we don't need that.
					//console.log("Unknown javascript file '" + req.params.info + "'");
					res.status(404).json('Unknown static file ' + filePath);                        
                }
						
                break;
            case "start":
				// The request (info) will contain the default dimensions '<default_rows>;<default_columns>'.
				// This way the default dimensions only need to be hardcoded on the client side...
				var params = req.params.info.split(";");
				var rows = params[0];
				var columns = params[1];
				
				// When a config node is available on the server side, we will use it's dimensions to create a pseudo terminal.
				if (xtermShellNode) {
					rows = xtermShellNode.rows;
					columns = xtermShellNode.rows;
				}

                startTerminal(req.params.terminal_id, rows, columns, loggingEnabled);

				// Pass the rows and columns to the client, which have been used on the server to start the pseudo terminal.
				// The client needs to use the SAME values to create an Xterm.js terminal window, to avoid conflicts!
                res.status(200).json({rows: rows, columns: columns});
                break;
            case "stop":
                stopTerminal(req.params.terminal_id, "by user", loggingEnabled);
                res.status(200).json('success');
                break;
            case "write":
                var base64Decoded = new Buffer(req.params.info, 'base64').toString('ascii');
				
                // Process the command line data (info contains command line input)
                writeDataToTerminal(req.params.terminal_id, base64Decoded, loggingEnabled);
                res.status(200).json('success');
                break;
			case "heartbeat":
				// Restart the timer whenever a heartbeat arrives
				startTimer(req.params.terminal_id);
                res.status(200).json('success');
                break;
            default:
                console.log("Unknown command '" + req.params.command + "'");
                res.status(404).json('Unknown command');
        }
    });
}
