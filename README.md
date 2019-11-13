# node-red-contrib-xterm
A Node-RED node terminal front-end, to execute backend CLI commands.

## Install
Run the following npm command in your Node-RED user directory (typically ~/.node-red):
```
npm install node-red-contrib-xterm
```

## Node usage
Normally you should have only ***one instance*** of this node in your flow, since it is just a way to access your backend command line prompt via the Node-RED flow editor.

As soon as the config screen is being opened, you can start entering commands in the terminal window (which is connected to your Node-RED backend server):

![xterm_linux_demo](https://user-images.githubusercontent.com/14224149/68810110-aa80ef80-066d-11ea-9e71-8692309d9f60.gif)

## Node settings

#### Start command
The start command is a command that needs to be executed automatically as soon as the terminal session is being started.  For example ```cd $HOME/.node-red``` on Linux to navigate to your NOde-RED directory.

## Internals
A pty ("pseudo-terminal") is being spawned to read from and write to your terminal session programmatically.

TODO add flow diagram (with ajax and websocket)
