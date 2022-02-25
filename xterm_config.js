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
    const {EOL} = require('os');
    
    // -------------------------------------------------------------------------------------------------
    // Determining the path to the files in the dependent xterm module once.
    // See https://discourse.nodered.org/t/use-files-from-dependent-npm-module/17978/5?u=bartbutenaers
    // -------------------------------------------------------------------------------------------------
    var xtermPath = require.resolve("xterm");
    
    // For example suppose the require.resolved results in xtermPath = /home/pi/node-red-contrib-xterm/node_modules/xterm/lib/xterm.js
    // Then we need to strip the part after the /xterm/ folder, which means xtermPath = /home/pi/node-red-contrib-xterm/node_modules/xterm/
    // And then we need to find the /lib subfolder, which means xtermJsPath = /home/pi/node-red-contrib-xterm/node_modules/xterm/lib
    xtermPath = xtermPath.substring(0, xtermPath.indexOf(path.sep + "xterm" + path.sep) + 6);
    
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
    xtermFitPath = xtermFitPath.substring(0, xtermFitPath.indexOf(path.sep + "xterm-addon-fit" + path.sep) + 16);
    
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
            
            // We will get a heartbeat from the client every 5 seconds.  When we haven't received that heartbeat within 15 seconds, we assume 
            // that the client has disconnected.  In that case the pseudo terminal of that client will be stopped...
            processInfo.timerId = setInterval(function() {
                stopTerminal(terminalId, "heartbeat", loggingEnabled);
            }, 15000);
        }
    }

    function stopTerminal(terminalId, reason, loggingEnabled) {  
        var processInfo = xtermProcessInfoMap.get(terminalId);
        
        if (processInfo) {        
            try {
                // The "exit" and "SIGINT" event handlers had been added to detect the ptyProcess being killed behind our back.
                // But if we kill the process, we don't want those handlers to do anything.  Otherwise this happens when the (re)start button is clicked:
                // 1. The current process is stopped
                // 2. A new process is started
                // 3. The exithandler is called (due to step 1), which would kill our new process (from step 2).
                // This way we avoid that stap 3 happens, when we kill the process ourselves.
                processInfo.ptyProcess.removeAllListeners("exit");
             
                processInfo.ptyProcess.kill();
                
                if (processInfo.timerId) {
                    clearInterval(processInfo.timerId);
                }
                
                xtermProcessInfoMap.delete(terminalId);
                
                // Let the client know that the pseudo terminal has been stopped, in case the client isn't disconnected 
                // (but the heartbeat didn't arrive in time)
                RED.comms.publish("xterm_shell", JSON.stringify( { terminalId: terminalId, content: "Pseudoterminal has been stopped (by " + reason + ")", type: "info" } ));
            }
            catch (err) {
                RED.comms.publish("xterm_shell", JSON.stringify( { terminalId: terminalId, content: "Cannot stop pseudoterminal (by " + reason + "): " + err, type: "error" } ));
            }
        }
        else {
            RED.comms.publish("xterm_shell", JSON.stringify( { terminalId: terminalId, content: "Pseudoterminal had not been started yet", type: "info" } ));
        }
    }
    
    function startTerminal(terminalId, rows, columns, loggingEnabled) {
        // When the previous ptyProcess was still running, we will stop it.
        if (xtermProcessInfoMap.has(terminalId)) {
            console.log("Previous ptyProcess was already started");
            stopTerminal(terminalId, "(re)start button", loggingEnabled);
        }
        
        try {
            const env = Object.assign({}, process.env);
            env['COLORTERM'] = 'truecolor';
        
            rows = parseInt(rows || 24);
            cols = parseInt(columns || 80);
            
            // Create a child process of the current (Node-RED) process
            var ptyProcess = pty.spawn(process.platform === 'win32' ? 'cmd.exe' : 'bash', [], {
              name: 'xterm-256color',
              cols: cols,
              rows: rows,
              cwd: env.PWD,
              env: env,
              encoding: xtermUseBinaryTransport ? null : 'utf8'
            });
            
            ptyProcess.on('data', function(data) {
                try {
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
            
            ptyProcess.on('exit', function(c) {
                // We arrive here always the ptyProcess is exited.  But when the trigger is a CLI command (e.g. "exit" in Linux),
                // we still need to remove the ptyProcess from our map ...
                if (xtermProcessInfoMap.has(terminalId)) {
                    stopTerminal(terminalId, "exit command", loggingEnabled);
                }
            });
            
            ptyProcess.on('SIGINT', c => {
                // We arrive here always the ptyProcess is killed.  But when the trigger from somewhere outside,
                // we still need to remove the ptyProcess from our map ...
                if (xtermProcessInfoMap.has(terminalId)) {
                    stopTerminal(terminalId, "SIGINT", loggingEnabled);
                }
            });

            RED.comms.publish("xterm_shell", JSON.stringify( { terminalId: terminalId, content: "Pseudoterminal has been started (pid=" + ptyProcess.pid + " rows=" + rows + " cols=" + cols + ")", type: "info" } ));
            
            xtermProcessInfoMap.set(terminalId, {ptyProcess: ptyProcess});
            
            // From here on the heartbeats need to be monitored
            startTimer(terminalId);
        }
        catch (err) {
            RED.comms.publish("xterm_shell", JSON.stringify( { terminalId: terminalId, content: "Cannot start pseudoterminal: " + err, type: "error" } ));
        }
    }
       
    function writeDataToTerminal(terminalId, data, loggingEnabled) {
        var errorText;
        
        try {
            var processInfo = xtermProcessInfoMap.get(terminalId);
            
            if (processInfo) {
                processInfo.ptyProcess.write(data);
                
                if (loggingEnabled) {
                    var dataType = Object.prototype.toString.call(data);
                    console.log("Terminal data from client (type = " + dataType + "): " + data);
                }
            }
            else {
                errorText = "Cannot execute commands when the pseudoterminal is not started yet";
                RED.comms.publish("xterm_shell", JSON.stringify( { terminalId: terminalId, content: errorText, type: "error" } ));
            }
        }
        catch (err) {
            errorText = "Cannot write date to pseudoterminal: " + err;
            RED.comms.publish("xterm_shell", JSON.stringify( { terminalId: terminalId, content: errorText, type: "error" } ));
        } 

        return errorText;
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
    
    // Make all static resources (i.e. library files) available to the flow editor.
    // We use a separate endpoint, since no permissions are required to read those resources.
    // Otherwise we get 'unauthorized' problems, when calling this endpoint from a 'script' tag.
    // See details on https://discourse.nodered.org/t/unauthorized-when-accessing-custom-admin-endpoint/20201/4
    RED.httpAdmin.get('/xterm_shell/lib/:filename', function(req, res) {
        var filePath;
                    
        switch (req.params.filename) {
            case "xterm.js":
                filePath = xtermJsPath;
                break;
            case "xterm-addon-fit.js":
                filePath = xtermFitJsPath;
                break;   
            case "xterm.css":
                filePath = xtermCssPath;
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
            res.status(404).json({error: 'Unknown static file ' + filePath});                        
        }
    });
    
    // Determine the line endings
    function determineLineEnding(text) {                
        var index = text.indexOf('\n');
        
        if (index < 0) {
            return null;
        }
        
        if (index > 0 && text[index - 1] === '\r') {
             return "\r\n";
        }
        
        return "\n";
    }

    // Process the POST requests from the flow editor
    RED.httpAdmin.post('/xterm_shell/command', RED.auth.needsPermission('xterm_shell.write'), function(req, res) {
        // When a config node is available on the server side, we see whether logging should be enabled
        var loggingEnabled = xtermShellNode && xtermShellNode.loggingEnabled;

        // Get the POST parameters
        var command     = req.body.command;
        var terminal_id = req.body.terminal_id;
        var info        = req.body.info;
        
        try {
            switch (command) {
                case "start":
                    // The request (info) will contain the default dimensions '<default_rows>;<default_columns>'.
                    // This way the default dimensions only need to be hardcoded on the client side...
                    var params = info.split(";");
                    var rows = params[0];
                    var columns = params[1];
                    
                    // When a config node is available on the server side, we will use it's dimensions to create a pseudo terminal.
                    if (xtermShellNode) {
                        rows = xtermShellNode.rows;
                        columns = xtermShellNode.columns;
                    }

                    startTerminal(terminal_id, rows, columns, loggingEnabled);

                    // Pass the rows and columns to the client, which have been used on the server to start the pseudo terminal.
                    // The client needs to use the SAME values to create an Xterm.js terminal window, to avoid conflicts!
                    res.status(200).json({rows: rows, columns: columns});
                    break;
                case "stop":
                    stopTerminal(terminal_id, "stop button", loggingEnabled);
                    res.status(200).json({});
                    break;
                case "write":
                    var base64Decoded = new Buffer(info, 'base64').toString('ascii');
                    
                    var lineEnding = determineLineEnding(base64Decoded);
                    
                    // On Windows the line-endings are a carriage return (\r) and a newline(\n), also referred to as CR/LF. 
                    // On UNIX the line-endings are a newline character (\n), also referred to as a linefeed (LF).
                    // If the EOL of the current operating system differs from \r\n (which we use by default), then adapt it.
                    // Because the flow editor (where the code has been entered) might be running on a different OS...
                    if (lineEnding != EOL) {
                        base64Decoded = base64Decoded.replace(lineEnding, EOL);
                    }
                    
                    // Process the command line data (info contains command line input)
                    var errorText = writeDataToTerminal(terminal_id, base64Decoded, loggingEnabled);
                    
                    // The xterm_in node (doesn't listen to the websocket so it) has to be informed whether the command
                    // has been transferred to the pseudo terminal correctly
                    if (!errorText) {
                        res.status(200).json({});
                    }
                    else {
                        res.status(500).json({error: errorText});
                    }
                    break;
                case "heartbeat":
                    // Restart the timer whenever a heartbeat arrives
                    startTimer(terminal_id);
                    res.status(200).json({}); 
                    break;
                default:
                    console.log("Unknown command '" + command + "'");
                    res.status(404).json({error: 'Unknown command'});
            }
        }
        catch(err) {
            // Lots of server-side processing, so lots of things can go wrong.
            // Avoid that the client doesn't know what is going on,i.e. avoid internal server errors (status 500)
            res.status(500).json({error: err.name, message: err.message, stack: err.stack });
            console.log("Error while executing command '" + command + "':");
            console.log(err.stack);
        }
    });
}
