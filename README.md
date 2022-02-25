# node-red-contrib-xterm
A Node-RED node terminal front-end, to execute backend CLI commands.

## Install
Run the following npm command in your Node-RED user directory (typically ~/.node-red):
```
npm install bartbutenaers/node-red-contrib-xterm
```

*Remark: when installing this node, NPM will show a warning in the console log:*

![npm warning](https://user-images.githubusercontent.com/14224149/73590674-6c190500-44e5-11ea-85bb-e90875fd12e7.png)

*Reason is that the xterm-addon-fit (which is an xterm plugin) has xterm as (peer) dependency in its [package.json](https://github.com/xtermjs/xterm.js/blob/master/addons/xterm-addon-fit/package.json) file, and since npm version 3.x such peer dependencies aren't installed automatically anymore.  But that is NO problem since xterm is installed automatically anyway, when you install this Node-RED node ...*

## Support my Node-RED developments
Please buy my wife a coffee to keep her happy, while I am busy developing Node-RED stuff for you ...

<a href="https://www.buymeacoffee.com/bartbutenaers" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Buy my wife a coffee" style="height: 41px !important;width: 174px !important;box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;-webkit-box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;" ></a>

## Security !!!!!!!!

:warning: ***Since this node allows commands to be executed on the server, it is very important that your Node-RED is secured!***

But you should take care of that anyway, since other nodes (e.g. Exec and Daemon nodes) also allow execution of commands on the server ... 

To avoid introducing extra security riscs, this node uses the standard Node-RED communication mechanism (see also the 'Detailed Information' section below):
+ The ajax calls are send to a Node-RED http admin endpoint.
+ The data is pushed via the Node-RED ```RED.comms``` websocket channel.

As a result: when you have secured your Node-RED environment, the communication for this terminal will have the same security level...

All processes launched from node-pty will launch at the same permission level of the parent process (i.e. the Node-RED process). Take care particularly when using node-pty inside a server that's accessible on the internet.  It is recommended to launch the pseudo-terminal inside a container (like e.g. a Docker container) to protect the host machine.

## Node usage
This contribution offers a terminal window entirely integrated into Node-RED.
It consists out of two parts that closely work together:
+ A ***sidebar tabsheet*** where the terminal window is displayed, which can be used to enter commands that need to be executed on the server (that runs Node-RED).
+ A ***Terminal input*** node which can be used to store your favorite commands, and send them to the terminal.

Each flow editor instance will have its own terminal session on the server side, which means that each editor will have its own independent terminal screen.  As a result, multiple users can execute commands (in their own flow editor instance), independently from each other.

Currently macOS, Linux and Windows are supported on the server side.

Remark: this node can be used to connect to the server, where the Node-RED backend is running.  But it is also possible to logon to other servers, for example on Linux using the ```ssh``` command.  Thanks to [Paul](https://github.com/juggledad) for explaining this step by step in this [discussion](https://discourse.nodered.org/t/announce-node-red-contrib-xterm-second-beta-sidebar/19718/45).

## Sidebar tabsheet

A custom sidebar tabsheet is available, that can be setup in a few steps:
1. Navigate to the *'Terminal'* tabsheet in the sidebar.
1. Press the *'Start'* button to start a pseudo terminal (on the server side), and simultaneously display an Xterm terminal window (in the sidebar).
1. Start entering your CLI commands into the terminal window.  Depending on the server's operating system, other commands will be required.
1. Press the *'Clear'* button to clear the content of the terminal window.
1. In case of problems with the pseudo terminal (on the server), you can press the *'Start'* button again.  Then the pseudo terminal (on the server) will be stopped and a new pseudo terminal will be started automatically.
1. If the pseudo terminal is not needed anymore, you could press the *'Stop'* button.  This might be useful in a multi-user environment, since the number of allowed pseudo terminals can be restricted on some systems.  
   Remark: it is also possible to use CLI commands to quit the terminal session (e.g. "exit" command on Linux).
1. Optionally the terminal window settings can be customized in the *"Settings"* tabheet, but follow the instructions on that tabsheet to activate those changes.  Indeed the number of rows and columns of the terminal window (client side) and the pseudo terminal (server side) should always be identical!  Otherwise texts will start *overlapping* (i.e. overriding) in the terminal window!

All node-related information (pseudo terminal started, pseudo terminal stopped, ...) and server side errors are being displayed INSIDE the terminal window.

A short demo of the sidebar tabsheet:

![xterm_demo_sidebar](https://user-images.githubusercontent.com/14224149/71563581-36ba6b00-2a92-11ea-8f3f-1e37e714066b.gif)

The following settings can be adjusted, to customize the terminal window:

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

## Terminal Input node
The *"Terminal Input"* node can be used to store frequently used commands, and inject those commands into the terminal.

A short demo to explain how it works:

![xterm_demo_input](https://user-images.githubusercontent.com/14224149/71563905-d0d0e200-2a97-11ea-8d1d-29f08981ac03.gif)

```
[{"id":"800e772a.b109c8","type":"xterm_in","z":"e2675d9d.6854e","command":"ls -ltr","addEnter":true,"confirmation":false,"name":"Directory listing","x":1260,"y":180,"wires":[]},{"id":"5a5f258.ad842dc","type":"xterm_in","z":"e2675d9d.6854e","command":"df -h","addEnter":true,"confirmation":false,"name":"Top disc usage","x":1260,"y":240,"wires":[]},{"id":"8ae725e0.57d5a8","type":"xterm_in","z":"e2675d9d.6854e","command":"ifconfig","addEnter":true,"confirmation":false,"name":"Network configuration","x":1280,"y":300,"wires":[]},{"id":"598184d3.be34ec","type":"xterm_in","z":"e2675d9d.6854e","command":"Iwlist wlan0 scan","addEnter":true,"confirmation":false,"name":"Available wireless networks","x":1300,"y":360,"wires":[]},{"id":"236fb7f7.0affc8","type":"xterm_in","z":"e2675d9d.6854e","command":"reboot","addEnter":true,"confirmation":true,"name":"Reboot","x":1240,"y":420,"wires":[]},{"id":"9dba7376.805f1","type":"xterm_in","z":"e2675d9d.6854e","command":"shutdown -h now","addEnter":true,"confirmation":true,"name":"Shutdown","x":1250,"y":480,"wires":[]},{"id":"5a5741.492658c","type":"xterm_in","z":"e2675d9d.6854e","command":"pwd","addEnter":true,"confirmation":false,"name":"Current directory","x":1260,"y":120,"wires":[]},{"id":"ee8feb7c.0cf0d8","type":"xterm_in","z":"e2675d9d.6854e","command":"pwd\npwd\npwd","addEnter":false,"confirmation":false,"name":"Example script","x":1260,"y":540,"wires":[]}]
```

The following settings can be adjusted, to customize the behaviour of the Terminal Input node:

### Command(s):
Specify the command(s) that need to be executed in the terminal window . Multiple commands (each on a separate line!) can be added to create a *script*, as you can see in this demo:

![xterm_demo_input_multiple](https://user-images.githubusercontent.com/14224149/71563941-83a14000-2a98-11ea-8b6a-8255f71d6ae0.gif)

### Add 'enter' automatically:
Specify whether an 'enter' key (i.e. a newline character) will be added automatically after the last command.

+ When selected, the specified command will be executed immediately (automatically).
+ When unselected, the specified command will not be executed automatically. Which means it appears in the terminal window, but you have to press manually the enter key to execute it.

Remark: this checkbox has more added value in case of a single command, since multiple commands are separated by enter's anyway ...

### Show confirmation popup:
Critical commands (e.g. reboot the system) can be protected by a confirmation dialog, to avoid those commands being executed in the wrong circumstances. E.g. you might have pressed the inject button by accident...

The following demo explains how to a *'reboot'* command can be secured, and cancelled when being clicked:

![xterm_demo_input_confirmation](https://user-images.githubusercontent.com/14224149/71563976-d67af780-2a98-11ea-96ed-ac4dc1df79a2.gif)

## Detailed information

### Communication trajectory

The following diagram explains the entire trajectory between the terminal and the operating system:

![trajectory](https://user-images.githubusercontent.com/14224149/69183121-a4c65680-0b12-11ea-9181-80eb6306c353.png)

1. When the user opens the node's config screen, an [Xterm.js](https://xtermjs.org/) terminal screen is displayed (and a node-pty process is spawned on the server).
2. When the user enters a command (e.g. *"ls -ltr"*), this command will be send to the server (via a separate ajax call for ***each*** character).
3. The *pseudo terminal* ([node-pty](https://github.com/microsoft/node-pty)) emulates a hardware terminal.  This means that it can send user input to the shell, and receive output from that shell.  In other words it can read from and write to your terminal session programmatically
4. The pseudo-terminal output will be pushed via a websocket channel back to the client.
5. The Xterm.js terminal screen will show the terminal output (which contains both the user input and all other data).

This communication mechanism allows data to be pushed on the fly to the terminal (e.g. when tailing a file), where it will be displayed to the user).

### Limitations
Since multiple flow editors can be active at the same time, some kind of terminal management is required.  To accomplish this, the sidebar coding assigns a ***unique terminal Id*** to the flow editor where it is being displayed.  That terminal id is being transferred all the time between the terminal window (client side) and the pseudo terminal (server side), to make sure the data of the multiple terminals doesn't get mixed.

This is also the main reason why I had to implement my own *Terminal Input* node: this node will also sends that unique terminal id to the server, to make sure that the data will be inject in the terminal window of the **SAME** flow editor (where the Terminal Input node's button has been clicked)!  If I would have reused the Inject node, the server wouldn't have been able to determine in which terminal the data should be inserted.  *Therefore it is not possible to use the Inject node to inject commands into the terminal!*

It would have been nice to have a *Terminal output* node, to capture the output of a command and process that data in your Node-RED flow.  However such a Terminal Output node runs on the server, which means it is a single node instance that would get the data from all commands from all connected terminals.  This way data from all connected terminals gets mixed, which is totally useless.  Moreover the data would also contain the input from the user (so not only the terminal output)!  *Therefore it is not possible to create a useful Terminal Output node.* 

It is also *not useful to have an output on the Terminal Input node*: a single Terminal Input node on the server side, will be visualized in every flow editor.  So the injected commands from all users will arrive at the same Terminal Input node instance, which means the data again will be mixed. 

### Prebuild binaries
The node-pty pseudo terminal is written partly in the C-language, which means it needs to be compiled during installation.  This requires the necessary build tools be installed on your system, and then it can cause a lot of headache solving all build conflichts...

However this node uses [node-pty-prebuilt-multiarch](https://github.com/oznu/node-pty-prebuilt-multiarch), which offers prebuilt node-pty binaries for a series of operating systems and hardware architectures:

![binaries](https://user-images.githubusercontent.com/14224149/72219154-2f3f9b00-3543-11ea-883f-ed415ddaccd2.png)

This way you can install this node hopefully a bit easier ...

But there will be lots of other platforms where the binaries will be build automatically.  On some platforms you will even have execute manual steps to get a succesfull build, like e.g. for Oracle Cloud Free Instance as described [here](https://discourse.nodered.org/t/announce-node-red-contrib-xterm-second-beta-sidebar/19718/2).

### Hearbeat
When a flow editor is being closed in the browser, the corresponding pseudo terminal process on the server should be stopped.  Otherwise the pseudo terminal processes keep stacking up, and the number of pseudo terminals is limited by the host operating system.  Since the server side cannot detect a flow editor being disconnected (see Nick's [answer](https://discourse.nodered.org/t/detect-when-flow-editor-is-closed/18357)), the sidebar tab will send a heartbeat to the server every 5 seconds.  When such a heartbeat doesn't arrive within 15 seconds, the pseudo terminal process (corresponding to the that terminal id) will be stopped automatically.

As a result you can also *refresh* your (flow editor) browser page, without running into troubles: the old pseudo terminal process will be killed within 15 seconds if the page should get a new unique terminal id.  And a new terminal can be started...

If this should occur unexpected (e.g. due to network latency problems), you just need to start the terminal again.  The *'Start'* and '*Stop*' buttons will always detect first whether a terminal is already running for this terminal id anyway ...
