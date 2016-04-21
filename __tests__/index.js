var Task = require('../lib/index.js');

function fetch(url) {

}

function timer(duration) {
    return new Task(function(resolve, reject) {
        var startTime = Date.now();
        var id = setTimeout(function() { resolve(Date.now() - startTime); }, duration);
        return function dispose() {
            clearTimeout(id);
            id = null;
        };
    });
}

function just(value) {
    return new Task(function(resolve, reject) {
        resolve(value);
    });
}

function justError(error) {
    return new Task(function(resolve, reject) {
        reject(error);
    });
}

describe('Task', function() {

    it('can be async', function(done) {
        timer(15).subscribe(function(duration) {
            if (duration < 15) {
                done(new Error("Duration was too short: " + duration));
            } else {
                done();
            }
        })
    });

    it('can be cancelled', function(done) {
        var count = 0;
        var cancel = timer(15).subscribe(
            function() { ++count; },
            function() { ++count; }
        );
        cancel();
        timer(30).subscribe(function() {
            if (count > 0) {
                done(new Error("Didn't cancel properly."));
            } else {
                done();
            }
        }, done);
    });

    it('can be chained', function(done) {
        timer(5)
            .map(function() { return timer(5) })
            .map(function() { return timer(5) })
            .map(function() { return timer(5) })
            .map(function() { return timer(5) })
            .subscribe(function() {
                done();
            });
    });

    it('can be nested deeply', function(done) {
        timer(5)
            .map(function() { return timer(5)
                .map(function() { return timer(5)
                    .map(function() { return timer(5)
                        .map(function() { return timer(5) })
                    })
                })
            })
            .subscribe(function() {
                done();
            });
    });

    it('can be cancelled with mixed sync and async', function(done) {
        var cancel = just(10)
            .map(function(value) {
                return just(value)
                    .map(function(value) {
                        return timer(value);
                    });
            })
            .subscribe(function() {
                done(new Error("shouldn't finish"));
            });

        cancel();

        timer(30).subscribe(function() {
            done();
        })
    });

    it('can be cancelled partway through an async chain', function(done) {
        var count = 0;
        function counter(delay) {
            return new Task(function(resolve, reject) {
                ++count;
                return timer(delay).subscribe(resolve, reject);
            });
        }
        var cancel = counter(10).map(
            counter(10)
                .map(counter(10)
                     .map(counter(10)
                          .map(function() { return 'hi'; }))))
            .subscribe(function(result) {
                done(new Error('should not finish'));
            }, function(error) {
                done(new Error(error));
            });

        timer(25)
            .subscribe(function() {
                cancel();
                timer(5).subscribe(function() {
                    if (count !== 3) {
                        done(new Error('expected 3 counters to go off'));
                    } else {
                        done();
                    }
                });
            }, done);
    });

    it('can map over tasks', function(done) {
        timer(1)
            .map(timer(2))
            .map(timer(3))
            .map(timer(4))
            .map(timer(5))
            .subscribe(function() {
                done();
            });
    });

    it('catches exceptions thrown in map', function(done) {
        just(10)
            .map(function() { oops; })
            .subscribe(function() {
                done(new Error("shouldn't succeed"));
            }, function(error) {
                if (!(error instanceof ReferenceError)) {
                    done(new Error("should have got ReferenceError"));
                } else {
                    done();
                }
            });
    })

    it('swallows errors without an error handler to subscribe', function(done) {
        just(10)
            .map(function() { oops; })
            .subscribe(function() {
                done(new Error("shouldn't succeed"));
            });
        done();
    })

    it('does not catch exceptions thrown in subscribe', function(done) {
        try {
        just(10)
            .subscribe(function() {
                oops;
            }, function(error) {
                done(new Error("shouldn't have caught error"));
            });
        } catch (error) {
            if (!(error instanceof ReferenceError)) {
                done(new Error("expected ReferenceError"));
            } else {
                done();
            }
        }
    })

    it('does not allow primitives passed to map', function(done) {
        try {
            just(1)
                .map(2)
                .subscribe(function(value) {
                    done(new Error('expected to throw'));
                }, function(error) {
                    done(new Error('expected to throw'));
                });
        } catch (error) {
            if (!(error instanceof TypeError)) {
                done(new Error('expected TypeError'));
            } else {
                done();
            }
        }
    });

});
