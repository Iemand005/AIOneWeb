

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
	}).then(function(response) { return response.json(); }).then(function(result) {
		var models = result.data;
		console.log(models);
		callback(models);
	});
};

/** 
 * @param {string} model 
 * @param {any[]} messages 
 * @param {(token:string)=>void} onTokenCallback 
 * @param {()=>void} onDoneCallback 
 */
AIOne.prototype.streamCompletion = function(model, messages, onTokenCallback, onDoneCallback) {
	if (!this.apiKey) throw new Error("API Key not defined");

	var bodyData = {
		"model": model,
		"messages": messages,
		"stream": true
	};

	fetch(this.baseUrl + "/chat/completions", {
		method: "POST",
		headers: {
			"Authorization": "Bearer " + this.apiKey,
			"Content-Type": "application/json"
		},
		body: JSON.stringify(bodyData)
	}).then(function(response) {
		if (!response.body) throw new Error("Streaming not supported by browser response");
		
		var reader = response.body.getReader();
		var decoder = new TextDecoder("utf-8");
		var buffer = "";

		function processChunk(chunkResult) {
			if (chunkResult.done) {
				if (onDoneCallback) onDoneCallback();
				return;
			}

			buffer += decoder.decode(chunkResult.value, { stream: true });
			var lines = buffer.split("\n");
			
			buffer = lines.pop() || "";

			for (var i = 0; i < lines.length; i++) {
				var line = lines[i].replace(/^\s+|\s+$/g, "");
				if (line === "") continue;
				if (line === "data: [DONE]") {
					if (onDoneCallback) onDoneCallback();
					return;
				}

				if (line.indexOf("data: ") === 0) {
					var jsonStr = line.substring(6);
					try {
						var parsed = JSON.parse(jsonStr);
						var delta = parsed.choices[0].delta;
						if (delta && delta.content) {
							onTokenCallback(delta.content);
						}
					} catch (e) {
						// Sla corrupte of onvolledige regels over
					}
				}
			}

			return reader.read().then(processChunk);
		}

		return reader.read().then(processChunk);
	})["catch"](function(err) {
		console.error("Stream error:", err);
	});
};

function initAIOne() {
	var apiForm = document.getElementById("api-form");
	var apiKeyInput = document.getElementById("api-key-input");
	var inputForm = document.getElementById("message-form");
	var messageInput = document.getElementById("message-input");
	var modelInput = document.getElementById("model-input");
	var outputDiv = document.getElementById("message-list");

	if (!(inputForm instanceof HTMLFormElement)) return;
	if (!(apiForm instanceof HTMLFormElement)) return;

	apiForm.onsubmit = function(ev) {
		ev.preventDefault();

		console.log("Sending model request...");
		if (apiKeyInput instanceof HTMLInputElement) {
			aiOne.apiKey = apiKeyInput.value.trim();
		}
		aiOne.getModels(function(models) {
			console.log("Received models liset!!", models);
		});
	};


	inputForm.onsubmit = function(ev) {
		ev.preventDefault();
		if (!(messageInput instanceof HTMLInputElement)) return;
		if (!(outputDiv instanceof HTMLInputElement)) return;

		var messageItem = document.createElement("li");
		// messageList
		outputDiv.appendChild(messageItem);

		console.log("Sending message...");

		var prompt = messageInput ? messageInput.value : "";
        var selectedModel = "llama-3.3-70b-versatile";
        
        var messages = [
            { "role": "user", "content": prompt }
        ];

        aiOne.streamCompletion(
            selectedModel, 
            messages, 
            function(token) {
                if (messageItem) {
                    messageItem.innerHTML += token;
                }
            }, 
            function() {
                console.log("Stream completely finished!");
            }
        );
	};
}

window.addEventListener("load", initAIOne, false);