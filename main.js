const { app, BrowserWindow, screen, ipcMain, Menu } = require('electron')
const path = require('path')
app.commandLine.appendSwitch('ignore-certificate-errors')
app.commandLine.appendSwitch('allow-insecure-localhost')

const isDev = process.env.NODE_ENV === 'development';
const getAssetPath = (filepath) => {
    if (isDev) {
        return path.join(__dirname, filepath);
    }
    return path.join(process.resourcesPath, filepath);
};

let mainWindow = null
let characterWindows = new Map();

function createWindow() {
    const display = screen.getPrimaryDisplay()
    const width = 400
    const height = 600
    
    mainWindow = new BrowserWindow({
        width: width,
        height: height,
        x: display.bounds.width - width,
        y: display.bounds.height - height,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false
        }
    })
    
    mainWindow.loadFile('character-settings.html')

    mainWindow.once('ready-to-show', () => {
        mainWindow.show()
    })

    const template = [
        {
            label: 'Developer',
            submenu: [
                {
                    label: 'Toggle DevTools',
                    accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
                    click: () => {
                        mainWindow.webContents.toggleDevTools();
                    }
                }
            ]
        }
    ];
    
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

function createCharacterWindow(characterFolder) {
    const display = screen.getPrimaryDisplay()
    const width = 400
    const height = 650
    
    const charWindow = new BrowserWindow({
        width: width,
        height: height,
        x: display.bounds.width - width,
        y: display.bounds.height - height,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        backgroundColor: '#00000000',
        hasShadow: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false
        }
    })
    
    const windowId = Date.now().toString();
    characterWindows.set(windowId, {
        window: charWindow,
        characterFolder: characterFolder
    });

    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('update-active-windows');
    });
    
    charWindow.loadFile('kiriko.html')
    const scaleFactor = display.scaleFactor
    charWindow.webContents.once('did-finish-load', () => {
        charWindow.webContents.send('load-character', characterFolder, scaleFactor)
    })

    charWindow.webContents.on('before-input-event', (event, input) => {
        if (input.control && input.shift && input.key.toLowerCase() === 'i') {
            charWindow.webContents.toggleDevTools()
        }
    })

    charWindow.on('closed', () => {
        characterWindows.delete(windowId);
        BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('update-active-windows');
        });
    });
}

ipcMain.on('change-character', (event, characterFolder) => {
    createCharacterWindow(characterFolder)
})

ipcMain.on('get-active-windows', (event) => {
    const windows = Array.from(characterWindows.entries()).map(([id, data]) => ({
        id,
        characterFolder: data.characterFolder
    }));
    event.reply('active-windows-list', windows);
});

ipcMain.on('close-character-window', (event, windowId) => {
    const windowToClose = characterWindows.get(windowId);
    if (windowToClose && windowToClose.window) {
        windowToClose.window.close();
        characterWindows.delete(windowId);
        BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('update-active-windows');
        });
    }
});

let dragOffset = { x: 0, y: 0 };

ipcMain.on('start-drag', (event, pos) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const [winX, winY] = win.getPosition();
    dragOffset = {
        x: winX - pos.x,
        y: winY - pos.y
    };
});

ipcMain.on('dragging', (event, pos) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win.setPosition(
        pos.x + dragOffset.x,
        pos.y + dragOffset.y
    );
});

ipcMain.on('resize-window', (event, {width, height}) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win.setSize(Math.ceil(width), Math.ceil(height));
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    event.preventDefault()
    callback(true)
})
  
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})
