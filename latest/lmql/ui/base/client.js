let appName = null;
let appPid = null;
var editors = {};
let clear_console_on_run = false;

// connect to socket.io server
socket = io.connect(':<<<PORT>>>');

window.renderer = {
    add_result: () => null,
    clear: () => null
};

socket.on('connect', () => {
    // get app name from URL /app/<app_name>
    appName = window.location.pathname.split('/')[2];
    const appNameElement = document.getElementById('app-name');
    if (!appName) {
        appNameElement.innerHTML = 'Please visit /app/:app_name.';
    } else {
        appNameElement.innerHTML = appName;
    }

    // listen for app content updates
    socket.on('app-result', data => {
        if (data.startsWith("DEBUGGER OUTPUT")) {
            try {
                data = JSON.parse(data.substr("DEBUGGER OUTPUT".length))
                if (window.renderer != null) {
                    window.renderer.add_result(data)
                }
            } catch {
                log_to_console("Failed to parse debugger output " + data.substr("DEBUGGER OUTPUT".length) + "\n")
            }
        } else {
            if (typeof data == "string") {
                log_to_console(data + "\n")
            } else {
                log_to_console(JSON.stringify(data) + "\n")
            }
        }
    })

    socket.on('app-pid', data => {
        appPid = data.pid;
    })

    // listen for app content updates
    socket.on('app-error', (error) => {
        log_to_console(error)
    })

    socket.on('app-exit', (error) => {
        log_to_console(error)
        setButtonStates("stopped")
    })
});

function onchange_clear_on_run() {
    const checkbox = document.getElementById('clear-on-run');
    clear_console_on_run = checkbox.value
}

function clear_console() {
    const appContentElement = document.getElementById('console-output');
    appContentElement.innerText = ""
}

function log_to_console(text) {
    const appContentElement = document.getElementById('console-output');
    appContentElement.innerText += text;
    appContentElement.scrollTop = appContentElement.scrollHeight;
}

var numRun = 0;

function setButtonStates(state) {
    const sendButton = document.getElementById('send-button');
    const stopButton = document.getElementById('stop-button');

    if (state == "running") {
        sendButton.disabled = true;
        stopButton.disabled = false;
        sendButton.innerText = "Running..."
    } else if (state == "stopped") {
        sendButton.disabled = false;
        stopButton.disabled = true;
        sendButton.innerText = "Run"
    } else if (state == "stopping") {
        sendButton.disabled = true;
        stopButton.disabled = true;
        sendButton.innerText = "Stopping..."
    } else {
        console.error("invalid button state", state)
    }
}

function stop() {
    if (appPid) {
        socket.emit("app-kill", {pid: appPid})
    }
    setButtonStates("stopping")
}

const ArgumentProviders = {
    providers: [],
    getArguments: () => {
        let args = []
        for (let provider of ArgumentProviders.providers) {
            args = args.concat(provider())
        }
        return args
    },
}

function run() {
    persistEditorContents()

    if (clear_console_on_run) {
        clear_console()
    }

    numRun++;
    let thisRunId = numRun;

    setButtonStates("running")

    if (!appName) {
        alert('The specified app could not be found..');
        return;
    }

    const appData = {
        "name": appName,
        // monaco get editor content
        "app_input": editors["editor"].getValue(),
        "app_arguments": ArgumentProviders.getArguments()
    }
    window.renderer.clear()
    socket.emit('app', appData);

    window.localStorage.setItem('app-input-' + appName, appData.app_input);
}

// load app-specific client.js
(function() {
    var js = document.createElement("script");

    js.type = "text/babel";
    let src = location.href;
    if (!src.endsWith("/")) src += "/"
    js.src = src + "app-client.js";

    document.body.appendChild(js);
})()

function persistEditorContents() {
    const appName = window.location.pathname.split('/')[2];
    window.localStorage.setItem("live-editor-content-" + appName, editors["editor"].getValue())
}

function initEditor(element) {
    const el = document.getElementById(element)
    require(['vs/editor/editor.main'], function () {
        let editor = monaco.editor.create(el, {
            model: monaco.editor.createModel("", "python"),
            renderWhitespace: 'boundary',
            fontSize: 18,
            minimap: {
                enabled: false,
            },
            // break lines
            wordWrap: "on",
        });

        editor.layout();
        window.editors[element] = editor;
        
        restorePersistedEditorContent()
    });
};

window.addEventListener("load", () => {
    initEditor("editor");
});

function restorePersistedEditorContent() {
    const appName = window.location.pathname.split('/')[2];
    const savedEditorContent = window.localStorage.getItem("live-editor-content-" + appName);
    
    editors["editor"].getModel().setValue(savedEditorContent);
}