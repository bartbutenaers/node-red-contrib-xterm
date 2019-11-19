# node-red-contrib-xterm
A Node-RED node terminal front-end, to execute backend CLI commands.

## Install
Run the following npm command in your Node-RED user directory (typically ~/.node-red):
```
npm install node-red-contrib-xterm
```

## Node usage
Normally you should have only ***one instance*** of this node in your flow, since it is only a way to access your backend command line prompt via the Node-RED flow editor.  Note that multi-terminal mode is supported, which means you can open multiple flow editors (each running a single terminal session).

As soon as the config screen is being opened, you can start entering commands in the terminal window (which is connected to your Node-RED backend server):

![xterm_linux_demo](https://user-images.githubusercontent.com/14224149/68810110-aa80ef80-066d-11ea-9e71-8692309d9f60.gif)

Remark: it should be possible to use this terminal for macOS, Linux and Windows.
Although I only have been able to test it on Linux...

## Node settings

#### Start command
The start command is a command that needs to be executed automatically as soon as the terminal session is being started.  For example ```cd $HOME/.node-red``` on Linux to navigate to your Node-RED directory.

### Grid
The number of rows and columns that need to be displayed inside the terminal.  Both characteristcs are specified in number of characters.

![grid](https://user-images.githubusercontent.com/14224149/69186006-0f2dc580-0b18-11ea-85ed-182e30f18e60.png)

### Cursor style
Specifies how the cursor should be displayed in the terminal window.  

### Fast scroll key
The modifier key hold to multiply scroll speed.

### Scrollback
The number of rows that are retained when lines are scrolled beyond the initial viewport. 

### Background
The background color of the terminal window.

### Foreground
The foreground color of the text on the terminal window.

### Scroll
The scroll speed multiplier used for scrolling.

### Fast scroll
The scroll speed multiplier used for fast scrolling.

### Blinking cursor
Whether the cursor should be blinking or not.  

### Draw bold text in bright colors
Whether to draw bold text in bright colors. 

### Enable data logging
Enable logging of all the data being send (both on client and server side), to simplify troubleshooting in case of problems.    

## Detail information

### Communication trajectory

The following diagram explains the entire trajectory between the terminal and the operating system:

![trajectory](https://user-images.githubusercontent.com/14224149/69183121-a4c65680-0b12-11ea-9181-80eb6306c353.png)

1. When the user opens the node's config screen, an [Xterm.js](https://xtermjs.org/) terminal screen is displayed (and a node-pty process is spawned on the server).
2. When the user enters a command (e.g. *"ls -ltr"*), this command will be send to the server (via a separate ajax call for each character).
3. The *pseudo terminal* ([node-pty](https://github.com/microsoft/node-pty)) emulates a hardware terminal.  This means that it can send user input to the shell, and receive output from that shell.  In other words it can read from and write to your terminal session programmatically
4. The pseudo-terminal output will be pushed via a websocket channel back to the client.
5. The Xterm.js terminal screen will show the terminal output (which contains both the user input and all other data).

This communication mechanism allows data to be pushed on the fly to the terminal (e.g. when tailing a file), where it will be displayed to the user).

#### Security
The standard Node-RED communication mechanism is being used:
+ The ajax calls are send to a Node-RED http admin endpoint.
+ The data is pushed via the Node-RED ```RED.comms``` websocket channel.

This means that when you have secured your Node-RED communications, that the communication for this terminal also will be secured...

All processes launched from node-pty will launch at the same permission level of the parent process (i.e. the Node-RED process). Take care particularly when using node-pty inside a server that's accessible on the internet.  It is recommended to launch the pseudo-terminal inside a container (like e.g. a Docker container) to protect the host machine.

#### Prebuild binaries
The node-pty pseudo terminal is written partly in the C-language, which means it needs to be compiled during installation.  This requires the necessary build tools be installed on your system, and then it can cause a lot of headache solving all build conflichts...

However this node uses [node-pty-prebuilt-multiarch](https://github.com/oznu/node-pty-prebuilt-multiarch), which offers prebuilt node-pty binaries for a series of operating systems and hardware architectures.  This way you can install this node hopefully a bit easier ...
