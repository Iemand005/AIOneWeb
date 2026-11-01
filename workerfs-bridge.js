
Module['preRun'] = Module['preRun'] || [];

Module['preRun'].push(function() {
    FS.mkdir('/models');

    FS.mount(WORKERFS, {
        files: [Module['workerFile']]
    }, '/models');
});
