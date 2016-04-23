var Task = require('../lib/index.js');

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

function error(error) {
    return new Task(function(resolve, reject) {
        reject(new Error(error));
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

    it('expects a mapped task to be a task', function() {
        var taskMapFunc = just(1).map(function() {});
        var taskMapTask = just(1).map(just(2));
        if (!(taskMapFunc instanceof Task)) {
            throw new TypeError('expected instanceof Task to be true');
        }
        if (!(taskMapTask instanceof Task)) {
            throw new TypeError('expected instanceof Task to be true');
        }
    });

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

    describe('Task.all', function() {

        it('resolves immediately with an empty array when given no tasks', function(done) {
            Task.all().subscribe(function(value) {
                if (!Array.isArray(value) || value.length > 0) {
                    done(new Error('expected empty array, got ' + value));
                } else {
                    done();
                }
            }, function(error) {
                done(error);
            });
        });

        it('can resolve just one task', function(done) {
            Task.all(just(3))
                .subscribe(function(results) {
                    if (!Array.isArray(results) || results.length !== 1 || results[0] !== 3) {
                        done(new Error('results were wrong'));
                    } else {
                        done();
                    }
                }, function(error) {
                    done(error || new Error('failed'));
                })
        });

        it('can resolve an array of tasks', function(done) {
            Task.all([just(1), just(2), just(3)])
                .subscribe(function(results) {
                    if (!Array.isArray(results)
                        || results.length !== 3
                        || results[0] !== 1
                        || results[1] !== 2
                        || results[2] !== 3)
                    {
                        done(new Error('malformed results: ' + results));
                    } else {
                        done();
                    }
                }, function(error) {
                    done(error);
                });
        });

        it('can resolve variadic arguments of tasks', function(done) {
            Task.all(just(1), just(2), just(3))
                .subscribe(function(results) {
                    if (!Array.isArray(results)
                        || results.length !== 3
                        || results[0] !== 1
                        || results[1] !== 2
                        || results[2] !== 3)
                    {
                        done(new Error('malformed results: ' + results));
                    } else {
                        done();
                    }
                }, function(error) {
                    done(error);
                });
        });

        it('rejects with the first error it gets', function(done) {
            Task.all(just(1), just(2), error('bah'), just(3))
                .subscribe(function(results) {
                    done(new Error('how dare you'));
                }, function(error) {
                    if (error.message !== 'bah') {
                        done(error);
                    } else {
                        done();
                    }
                })
        });

        it('rejects if an exception is thrown from subscribe', function(done) {
            var shit = new Task(function(resolve, reject) {
                throw new Error('fuck youuu');
            });
            Task.all(shit).subscribe(function(value) {
                done(new Error('should not succeed'));
            }, function(error) {
                if (error.message !== 'fuck youuu') {
                    done(error);
                } else {
                    done();
                }
            })
        });

        it('handles async fine', function(done) {
            var startTime = Date.now();
            Task.all([
                timer(10),
                timer(20).map(error('damn')),
                timer(30)
            ])
            .subscribe(function(result) {
                done(new Error('expected failure'));
            }, function(error) {
                var duration = Date.now() - startTime;
                if (error.message !== 'damn') {
                    done(error);
                } else if (duration >= 30) {
                    done(new Error('took too long'));
                } else {
                    done();
                }
            })
        });

    });

});
