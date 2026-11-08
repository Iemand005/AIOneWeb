Module['preRun'] = Module['preRun'] || [];

Module['preRun'].push(function() {
    FS.mkdir('/models');

    const files = Module['workerFiles']
        ?? (Module['workerFile'] ? [Module['workerFile']] : []);

    if (files.length > 0) {
        FS.mount(WORKERFS, { files }, '/models');
    }
});
