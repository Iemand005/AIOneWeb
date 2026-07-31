

function AIOne() {
    this.baseUrl = "https://api.groq.com/openai/v1";
    this.apiKey = "";
}

var aiOne = new AIOne();

/** @param {(models:string[])=>void} callback */
AIOne.prototype.getModels = function(callback) {
    if (!this.apiKey) throw new Error("API Key not defined");

    fetch(this.baseUrl + "/models", {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${this.apiKey}`,
            "Content-Type": "application/json"
        }
    }).then(function(result) {
        var models = result.data;
        console.log(models);
        callback(models);
    });
};

function onLoad() {
    var apiForm = document.getElementById("api-form");
    /** @type {HTMLInputElement?} */
    var apiKeyInput = document.getElementById("api-key-input");
    var inputForm = document.getElementById("message-form");

    apiForm.onsubmit = function(ev) {
        ev.preventDefault();

        console.log("Sending model request...");
        if (apiKeyInput) {
            aiOne.apiKey = apiKeyInput.value.trim();
        }
        aiOne.getModels(function(models) {
            console.log("Received models liset!!", models);
        });
    };


    inputForm.onsubmit = function(ev) {
        ev.preventDefault();

        console.log("Sending message...");
    };
}

window.addEventListener("load", onLoad, false);