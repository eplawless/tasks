var noop = function() {};

function Task(subscribe) {
    this._subscribe = subscribe;
}

Task.prototype.map = function map(transform) {
    if (typeof transform === 'function') {
        return new MappedTask(this, transform);
    } else if (transform instanceof Task) {
        return new MappedTask(this, function() { return transform; });
    } else {
        throw new TypeError('Expected transform to be a function or a Task, got ' + typeof transform);
    }
};

Task.prototype.subscribe = function subscribe(resolve, reject) {
    return this._subscribe(resolve || noop, reject || noop) || noop;
};

function MappedTask(parent, transform) {
    this._parent = parent;
    this._transform = transform;
}

MappedTask.prototype = Object.create(Task.prototype);
MappedTask.prototype.constructor = MappedTask;
MappedTask.prototype.subscribe = function subscribe(resolve, reject) {
    var cancel;
    var subscribeCount = 0;
    function next(result) {
        if (result instanceof Task) {
            var lastSubscribeCount = ++subscribeCount;
            try {
                var nextCancel = result.subscribe(next, reject);
            } catch (error) {
                cancel = noop;
                (reject || noop)(error);
                return;
            }
            if (subscribeCount === lastSubscribeCount) {
                cancel = nextCancel;
            }
        } else {
            (resolve || noop)(result);
        }
    }

    var transform = this._transform;
    var firstCancel = this._parent.subscribe(function(value) {
        try {
            var result = transform(value);
        } catch (error) {
            (reject || noop)(error);
            return;
        }
        next(result);
    }, reject);

    cancel = cancel || firstCancel;
    return function() { cancel(); };
};

Task.all = function all() {
    if (arguments.length === 1 && Array.isArray(arguments[0])) {
        return all.apply(this, arguments[0]);
    }
    if (arguments.length === 0) {
        return new Task(function(resolve, reject) {
            resolve([]);
        });
    }
    var tasks = Array.prototype.slice.call(arguments, 0);
    return new Task(function(resolve, reject) {
        var isCancelled = false;
        var disposeMethods = [];
        function cancelAll() {
            if (isCancelled) return;
            isCancelled = true;
            disposeMethods.forEach(function(dispose) {
                if (typeof dispose === 'function') {
                    dispose();
                }
            });
        };

        var results = [];
        var refCount = tasks.length;
        results.length = disposeMethods.length = tasks.length;
        try {
            tasks.forEach(function(task, idx) {
                if (isCancelled) return;
                var dispose = task.subscribe(function(result) {
                    if (isCancelled) return;
                    results[idx] = result;
                    if (--refCount <= 0) {
                        resolve(results);
                    }
                }, function(error) {
                    if (isCancelled) return;
                    cancelAll();
                    reject(error);
                });
                if (isCancelled) return;
                disposeMethods[idx] = dispose;
            });
        } catch (error) {
            if (isCancelled) return;
            cancelAll();
            reject(error);
        }
        return cancelAll;
    });
};

module.exports = Task;

