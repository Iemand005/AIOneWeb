

function AIOne() {
    this.baseUrl = "https://api.groq.com/openai/v1";
    this.apiKey = "";
}

function onLoad() {
    var apiForm = document.getElementById("api-form");
    apiForm.onsubmit = function(ev) {
        ev.preventDefault();

        console.log("Sending message...");
    };
    
    var inputForm = document.getElementById("message-form");
    inputForm.onsubmit = function(ev) {
        ev.preventDefault();

        console.log("Sending message...");
    };
}

window.addEventListener("load", onLoad, false);