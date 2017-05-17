var webServerAddress = "http://localhost:3043";
var queueServerAjaxURL = "/job/";
var testListURL = "/thor/tests/";
var execCmdURL = "/thor/exec/";

/**
 * Aggregation runner.
 */

jQuery(function($) {

  $(document).tooltip({ track: true });

  var applications = [];

  $.get(testListURL, function(data) {
    applications = data;

    var selectApplicationHeader = $("h2").filter(function(i, h2) {
      return h2.innerHTML.trim() == "Select application";
    });

    applications.forEach(function(application) {
      var radio = null;

      selectApplicationHeader.after(
        $("<div class='radio'>").append(
          $("<label>").append(
            radio = $("<input type='radio' name='applicationRadios'>").val(application.name),
            application.name
          )
        )
      );

      radio.on("click", function() {
        loadApplication(selectedApplication = getApplication($(this).val()));
      })
    });

    $(".loading").hide();
  });

  var getApplication = function(application) {
    for (var i = 0; i < applications.length; i++) {
      var currentApplication = applications[i];
      if (application == currentApplication.name) {
        return currentApplication;
      }
    }
  };

  /**
   * Utils.
   */

  var eachChild = function(element, f) {
    if (element) {
      if (element.packages) {
        $.each(element.packages, f);
      }
      if (element.classes) {
        $.each(element.classes, f);
      }
      if (element.methods) {
        $.each(element.methods, f);
      }
    }
  };

  var getMethods = function(element, acc) {
    eachChild(element, function(i, child) {
      if (child.methods) {
        $.each(child.methods, function(i, currentMethod) {
          acc.push(currentMethod);
        });
      }
      getMethods(child, acc);
    });
  };

  /**
   * User selection change handlers.
   */

  var select = function(element, which) {
    element.item.toggleClass("selected", which);
    selectCheckParents(element, which);
    eachChild(element, function(i, child) {
      select(child, which);
    });
  };

  var selectCheckParents = function(element) {
    var parent = element.parent;
    if (parent) {
      // If selecting element, we should select its parent, if all the children
      // of the parent is now selected (similar if deselecting)
      var allChildrenSelected = true;
      eachChild(parent, function(i, child) {
        allChildrenSelected = allChildrenSelected && child.item.hasClass("selected");
      });
      parent.item.toggleClass("selected", allChildrenSelected);
      selectCheckParents(parent);
    }
  };

  /**
   * Load application.
   */

  var loadApplicationObservers = [];

  var loadApplication = function(theApplication) {
    // Reset
    $("#select-parts").children().remove();

    // Check package defined
    if (!theApplication || !theApplication.packages || theApplication.packages.length == 0) {
      $("#select-parts").append($("<p>").text("Sorry, no possibilities found."));
      return;
    }

    if (theApplication.packages) {
      $.each(theApplication.packages, function(i, currentPackage) {
        loadPackage(currentPackage, $("#select-parts"));
      });
    }

    $.each(loadApplicationObservers, function(i, loadApplicationObserver) {
      loadApplicationObserver(theApplication);
    });
  };

  var loadPackage = function(thePackage, parent) {
    var list = $("<ul>").appendTo(parent);
    var item = $("<li>").addClass("package selector").text(thePackage.unqualifiedName).click(clickHandler(thePackage)).appendTo(list);
    var toggler = $("<a>").addClass("toggler").text("(-)").attr("href", "javascript:void(0)").click(function(event) {
      item.toggleClass("closed");
      $(this).text(item.hasClass("closed") ? "(+)" : "(-)");
      event.stopPropagation();
    }).appendTo(item);

    thePackage.item = item;

    if (thePackage.packages)
      $.each(thePackage.packages, function(i, currentPackage) {
        currentPackage.parent = thePackage;
        loadPackage(currentPackage, item);
      });

    if (thePackage.classes)
      $.each(thePackage.classes, function(i, currentClass) {
        currentClass.parent = thePackage;
        loadClass(currentClass, item);
      });
  };

  var loadClass = function(theClass, parent) {
    var list = $("<ul>");
    var item = $("<li>").addClass("class selector closed").text(theClass.name).click(clickHandler(theClass)).appendTo(list);
    if (theClass.name.indexOf("$") >= 0) {
      item.addClass("innerclass");
    }
    var toggler = $("<a>").addClass("method-toggler toggler").text("(+)").attr("href", "javascript:void(0)").click(function(event) {
      item.toggleClass("closed");
      $(this).text(item.hasClass("closed") ? "(+)" : "(-)");
      event.stopPropagation();
    }).appendTo(item);

    var methodList = $("<ul>").appendTo(item);

    theClass.item = item;

    if (theClass.methods)
      $.each(theClass.methods, function(i, currentMethod) {
        currentMethod.parent = theClass;
        loadMethod(currentMethod, methodList);
      });

    parent.append(list);
  };

  var loadMethod = function(theMethod, parent) {
    var item = $("<li>").addClass("method selector").text(theMethod.name).click(clickHandler(theMethod)).appendTo(parent);
    if (theMethod.unstable) {
      item.addClass("unstable");
      item.append($("<span>").addClass("glyphicon glyphicon-warning-sign").css("margin-left", "5px"));
    } else {
      item.addClass("stable");
    }

    theMethod.item = item;
  };

  var clickHandler = function(element) {
    return function(event) {
      select(element, !element.item.hasClass("selected"));
      event.stopPropagation();
    };
  };

  /**
   * Job succeeded/failed.
   */

  function updateMethodStatus(theApplication) {
    $(".glyphicon-ok-circle, .glyphicon-remove-circle").remove();

    var methods = [];
    getMethods(theApplication, methods);

    $.ajax({
      url: "/jobs/spoonRun/complete/0..1000/desc",
      type: "GET",
      success: function(spoonRuns) {
        $.each(spoonRuns, function(i, spoonRun) {
          var taskInfo = spoonRun.data.task;
          if (taskInfo.applicationId == theApplication.name) {
            $.each(methods, function(j, method) {
              if (taskInfo.class == method.parent.name && taskInfo.method == method.name) {
                var succeeded = !taskInfo.testFailed && !taskInfo.testRunFailed;
                method.item.append($("<a href=\"" + webServerAddress + "/out/spoonruns/" + taskInfo.uid + "\" target=\"_blank\" title=\"Job " + spoonRun.id + "\">").addClass("glyphicon glyphicon-" + (succeeded ? "ok" : "remove") + "-circle " + (succeeded ? "green" : "red")).css("margin-left", "5px"));
                return false;
              }
            });
          }
        });
      }
    });
  }

  loadApplicationObservers.push(updateMethodStatus);

  /**
   * Job listener.
   */

  var listenForIds = [];
  window.setInterval(function() {
    for (var i = 0; i < listenForIds.length; i++) {
      (function(i) {
        var id = listenForIds[i];
        $.get(queueServerAjaxURL + id, function(job) {
          if (job.type == "aggregate") {
            if (job.data && job.data.succeeded && job.data.failed) {
              $("#job-" + id + "-succeeded").text(job.data.succeeded.length);
              $("#job-" + id + "-failed").text(job.data.failed.length);
              $("#job-" + id + "-total").text(job.data.succeeded.length + job.data.failed.length);
              $("#job-" + id + "-succeeded-links").html(job.data.succeeded.map(function(id) {
                return "<a href=\"" + webServerAddress + "/out/spoonruns/" + id + "/index.html\" target=\"_blank\">X</a>";
              }).join(", "));
              $("#job-" + id + "-failed-links").html(job.data.failed.map(function(id) {
                return "<a href=\"" + webServerAddress + "/out/spoonruns/" + id + "/index.html\" target=\"_blank\">X</a>";
              }).join(", "));
            }

            if (job.state == "active" || job.state == "inactive") {
              return;
            }

            var jobContainer = $("#job-" + job.id).append("<br>"
              + "<a href=\"" + webServerAddress + "/out/aggregates/" + job.data.name + "/index.html\" target=\"_blank\">Go to aggregation</a>. "
              + "<a href=\"" + webServerAddress + "/out/coverage/reports/" + job.data.name + "/index.html\" target=\"_blank\">Go to coverage report</a>.");

            if (job.data.paths && job.data.paths.superGraph) {
              jobContainer.append(" <a href=\"" + job.data.remotePaths.superGraph + "\" target=\"_blank\">Go to super graph</a>.");
            }
          } else if (job.type == "viewBugCheck") {
            if (job.state == "active" || job.state == "inactive") {
              return;
            }

            var jobContainer = $("#job-" + job.id).append("<br><a href=\"/thor/view-bug-report.html#?data=" + job.data.name + "\" target=\"_blank\">Go to bug report</a>.");
          }

          if (job.state == "complete") {
            jobContainer.removeClass("bg-waiting").addClass("bg-success");
          } else {
            jobContainer.removeClass("bg-waiting").addClass("bg-danger");

            var message = job.error.message || job.error;
            if (message) {
              jobContainer.append("<br>" + message);
            }
          }

          listenForIds.remove(listenForIds.indexOf(id));
        });
      })(i);
    }
  }, 5000);

  $(window).bind("beforeunload", function() {
    if ($("#messages-block").hasClass("active")) {
      return "Warning! Message blocking is enabled, and will remain enabled if not turned off."
    }
    if (listenForIds.length > 0) {
      return "This page is still waiting on jobs to finish. Leave anyway?";
    }
  });

  /**
   * Filtering event handlers.
   */

  var stressTestingRadios = $("#page-aggregation-runner input[name=stressTestingRadios]");

  var superGraphModeCheckbox = $("#page-aggregation-runner input[name=superGraphMode]");
  var ignoreNoEffectModeCheckbox = $("#page-aggregation-runner input[name=ignoreNoEffectMode]");
  var usedServicesModeCheckbox = $("#page-aggregation-runner input[name=usedServicesMode]");
  var randomInjectionModeCheckbox = $("#page-aggregation-runner input[name=randomInjectionMode]");

  var replayCheckbox = $("#page-aggregation-runner input[name=replay]");
  var snapshotCheckbox = $("#page-aggregation-runner input[name=snapshot]");
  var collapseCheckbox = $("#page-aggregation-runner input[name=collapse]");
  var stopOnErrorCheckbox = $("#page-aggregation-runner input[name=stopOnError]");

  var ignoreInnerClassesCheckbox = $("#page-aggregation-runner input[name=ignoreInnerClasses]"), updateIgnoreInnerClasses;
  var ignoreStableCheckbox = $("#page-aggregation-runner input[name=ignoreStable]"), updateIgnoreStable;
  var ignoreUnstableCheckbox = $("#page-aggregation-runner input[name=ignoreUnstable]"), updateIgnoreUnstable;

  var updateCheckboxes = function() {
    var NONE = stressTestingRadios.filter(":checked").val() == "NONE";
    var AGGRESSIVE = stressTestingRadios.filter(":checked").val() == "AGGRESSIVE";
    var ALL = stressTestingRadios.filter(":checked").val() == "ALL";
    var SINGLE = stressTestingRadios.filter(":checked").val() == "SINGLE";
    var EXHAUSTIVE = stressTestingRadios.filter(":checked").val() == "EXHAUSTIVE";
    var MINIMIZE = stressTestingRadios.filter(":checked").val() == "MINIMIZE";

    var disableSuperGraphModeCheckbox = NONE || SINGLE || EXHAUSTIVE || MINIMIZE || randomInjectionModeCheckbox.is(":checked:enabled");
    var disableIgnoreNoEffectModeCheckbox = NONE || SINGLE || EXHAUSTIVE || MINIMIZE || AGGRESSIVE || collapseCheckbox.is(":checked:enabled");
    var disableUsedServicesModeCheckbox = NONE || SINGLE || EXHAUSTIVE || MINIMIZE || AGGRESSIVE;
    var disableRandomInjectionModeCheckbox = NONE || SINGLE || EXHAUSTIVE || MINIMIZE || AGGRESSIVE || superGraphModeCheckbox.is(":checked:enabled");

    var disableReplayCheckbox = NONE || EXHAUSTIVE || MINIMIZE || AGGRESSIVE;
    var disableSnapshotCheckbox = EXHAUSTIVE || MINIMIZE || AGGRESSIVE;
    var disableCollapseCheckbox = NONE || ignoreNoEffectModeCheckbox.is(":checked:enabled") || EXHAUSTIVE || MINIMIZE || AGGRESSIVE;
    var disableStopOnErrorCheckbox = NONE || EXHAUSTIVE || MINIMIZE;

    var disableIgnoreInnerClassesCheckbox = false;
    var disableIgnoreStableCheckbox = false;
    var disableIgnoreUnstableCheckbox = false;

    superGraphModeCheckbox.prop("disabled", disableSuperGraphModeCheckbox);
    ignoreNoEffectModeCheckbox.prop("disabled", disableIgnoreNoEffectModeCheckbox);
    replayCheckbox.prop("disabled", disableReplayCheckbox);
    snapshotCheckbox.prop("disabled", disableSnapshotCheckbox);
    collapseCheckbox.prop("disabled", disableCollapseCheckbox);
    stopOnErrorCheckbox.prop("disabled", disableStopOnErrorCheckbox);
    ignoreInnerClassesCheckbox.prop("disabled", disableIgnoreInnerClassesCheckbox);
    ignoreStableCheckbox.prop("disabled", disableIgnoreStableCheckbox);
    ignoreUnstableCheckbox.prop("disabled", disableIgnoreUnstableCheckbox);
    usedServicesModeCheckbox.prop("disabled", disableUsedServicesModeCheckbox);
    randomInjectionModeCheckbox.prop("disabled", disableRandomInjectionModeCheckbox);
  };

  stressTestingRadios.click(updateAll);

  superGraphModeCheckbox.click(updateAll);
  ignoreNoEffectModeCheckbox.click(updateAll);
  usedServicesModeCheckbox.click(updateAll);
  randomInjectionModeCheckbox.click(updateAll);

  collapseCheckbox.click(updateAll);
  stopOnErrorCheckbox.click(updateAll);

  ignoreInnerClassesCheckbox.click(updateIgnoreInnerClasses = function(event) {
    var checked = ignoreInnerClassesCheckbox.is(":checked:enabled");
    if ((typeof event == "object" && checked) || typeof event == "undefined") {
      $("#page-aggregation-runner .innerclass").toggle(!checked);
    } else {
      updateAll();
    }
  });

  ignoreStableCheckbox.click(updateIgnoreStable = function(event) {
    var checked = ignoreStableCheckbox.is(":checked:enabled");
    if ((typeof event == "object" && checked) || typeof event == "undefined") {
      $("#page-aggregation-runner .stable").toggle(!checked);
    } else {
      updateAll();
    }
  });

  ignoreUnstableCheckbox.click(updateIgnoreUnstable = function(event) {
    var checked = ignoreUnstableCheckbox.is(":checked:enabled");
    if ((typeof event == "object" && checked) || typeof event == "undefined") {
      $("#page-aggregation-runner .unstable").toggle(!checked);
    } else {
      updateAll();
    }
  });

  function updateAll() {
    console.log("Update all");
    $("#page-aggregation-runner #select-parts li").show();
    for (var i = 0; i < 3; i++) { // fixpoint
      setTimeout(function() {
        updateIgnoreInnerClasses();
        updateIgnoreStable();
        updateIgnoreUnstable();
        updateCheckboxes();
      }, 1);
    }
  }

  updateAll();

  /**
   * Initialize.
   */

  function getRunRequests() {
    var runRequests = [];
    eachChild(selectedApplication, function visit(i, child) {
      if (child.type == "method" && child.item.hasClass("selected")) {
        runRequests.push({
          class: child.parent.parent.name + "." + child.parent.name,
          method: child.name, unstable: child.unstable
        });
      } else {
        eachChild(child, visit);
      }
    });

    // Filter out inner classes
    var ignoreInnerClasses = $("input[name=ignoreInnerClasses]").is(":checked:enabled");
    var ignoreStable = $("input[name=ignoreStable]").is(":checked:enabled");
    var ignoreUnstable = $("input[name=ignoreUnstable]").is(":checked:enabled");

    return runRequests.filter(function(runRequest) {
      return (!ignoreInnerClasses || ignoreInnerClasses && runRequest.class.indexOf("$") < 0)
          && (!ignoreStable || ignoreStable && runRequest.unstable)
          && (!ignoreUnstable || ignoreUnstable && !runRequest.unstable);
    });
  }

  function id(req) {
    var result = [req.data.stress.type.toLowerCase()];
    if (req.data.stress.type == "EXHAUSTIVE") {
      result.push(req.data.stress.limit);
    }
    if (req.data.stress.type == "MINIMIZE") {
      result.push(req.data.stress.minimize.lowerBound);
      result.push(req.data.stress.minimize.upperBound);
    }
    if (req.data.stress.type != "NONE") {
      var eventTypes = $("select[name=stressTestingEventType] option:selected").map(function(i, e) {
        return $(e).attr("data-abbreviation");
      }).get();
      eventTypes.forEach(function(eventType) {
        result.push(eventType);
      });
      result.push(req.data.graphType);
    }
    if (req.data.superGraphMode) result.push("sg");
    if (req.data.snapshot) result.push("ss");
    if (req.data.collapse) result.push("col");
    if (req.data.stopOnError) result.push("stop");
    if (req.data.usedServicesMode) result.push("services");
    if (req.data.randomInjectionMode) result.push("random");
    return result.join("-");
  }

  var selectedApplication;

  $("#run").click(function() {
    // Collect requests
    var runRequests = getRunRequests();

    if (runRequests.length == 0) {
      alert("You must select at least one target to run.");
      return;
    }

    // Prepare request object
    var title = $("#page-aggregation-runner input[name=aggregationTitle]").val();
    var name = $("#page-aggregation-runner input[name=aggregationName]").val() || $("#page-aggregation-runner input[name=aggregationTitle]").val();
    var req = {
       type: "aggregate",
       data: {
          kind: $("#page-aggregation-runner input[name=aggregateOnly]").is(":checked:enabled") ? "aggregate-only" : "run",
          stress: {
            type: $("#page-aggregation-runner input[name=stressTestingRadios]:checked").val(),
            configurations: $("#page-aggregation-runner input[name=stressTestingRadios]:checked").val() != "SINGLE" ? [] : $("#page-aggregation-runner input[name=stressTestingSingleConfiguration]").val(),
            limit: $("#page-aggregation-runner input[name=stressTestingExhaustiveLimit]").val(),
            seeds: $("#page-aggregation-runner input[name=stressTestingExhaustiveSeeds]").val(),
            minimize: {
              lowerBound: $("#page-aggregation-runner input[name=stressTestingMinimizeLowerBound]").val(),
              upperBound: $("#page-aggregation-runner input[name=stressTestingMinimizeUpperBound]").val()
            },
            eventTypes: $("#page-aggregation-runner input[name=stressTestingRadios]:checked").val() == "NONE" ? [] : $("#page-aggregation-runner select[name=stressTestingEventType]").val()
          },
          superGraphMode: $("#page-aggregation-runner input[name=superGraphMode]").is(":checked:enabled"),
          graphType: $("#page-aggregation-runner input[name=graphType]:checked").val(),
          ignoreNoEffectMode: $("#page-aggregation-runner input[name=ignoreNoEffectMode]").is(":checked:enabled"),
          usedServicesMode: $("#page-aggregation-runner input[name=usedServicesMode]").is(":checked:enabled"),
          randomInjectionMode: $("#page-aggregation-runner input[name=randomInjectionMode]").is(":checked:enabled"),
          replay: $("#page-aggregation-runner input[name=replay]").is(":checked:enabled"),
          snapshot: $("#page-aggregation-runner input[name=snapshot]").is(":checked:enabled"),
          collapse: $("#page-aggregation-runner input[name=collapse]").is(":checked:enabled"),
          stopOnError: $("#page-aggregation-runner input[name=stopOnError]").is(":checked:enabled"),
          applicationId: $("#page-aggregation-runner input[name=applicationRadios]:checked").val(),
          tasks: runRequests,
          log: $("#page-aggregation-runner input[name=log]").is(":checked:enabled"),
          logFilter: $("input[name=logFilter]").val()
       }
    };

    var repetitions = parseInt($("#page-aggregation-runner select[name=aggregationRepetitions]").val());
    for (var repetition = 1; repetition <= repetitions; repetition++) {
      // Sending request
      req.data.title = title + "-" + id(req) + "-" + repetition;
      req.data.name  = name  + "-" + id(req) + "-" + repetition;
      $.ajax({
        url: queueServerAjaxURL,
        data: JSON.stringify(req),
        contentType: "application/json",
        type: "POST",
        success: function(data) {
          $("html, body").animate({ scrollTop: 0 }, 500, function() {
            if (data.message == "job created") {
              if (listenForIds.indexOf(data.id) == -1) {
                $("#messages-aggregation-runner").prepend(
                  $("<p id='job-" + data.id + "' class='bg-waiting'>Job id: " + data.id + ". Status: </p>")
                  .append($("<span class='green'>0</span>").attr("id", "job-" + data.id + "-succeeded"), " + ")
                  .append($("<span class='red'>0</span>").attr("id", "job-" + data.id + "-failed"), " = ")
                  .append($("<span>0</span>").attr("id", "job-" + data.id + "-total"), " of " + runRequests.length + ". ")
                  .append("Succeeded: ", $("<span>").attr("id", "job-" + data.id + "-succeeded-links"), ". ")
                  .append("Failed: ", $("<span>").attr("id", "job-" + data.id + "-failed-links"), ".")
                  .dblclick(function() {
                    $(this).remove();
                    var listenIndex = listenForIds.indexOf(data.id);
                    if (listenIndex >= 0) {
                      listenForIds.remove(listenIndex);
                    }
                  })
                );
                listenForIds.push(data.id);
              }
            } else {
              $("#messages-aggregation-runner").prepend(
                $("<p class='bg-danger'>Error creating job (message: " + data.message + ").</p>")
                .dblclick(function() {
                  $(this).remove()
                })
              );
            }
          });
        },
        error: function(data) {
          $("#messages-aggregation-runner").prepend($("<p class='bg-danger'>Error creating job.</p>"));
        }
      });
    }
  });

  $("#find-view-bugs").click(function() {
    // Collect requests
    var runRequests = getRunRequests();

    if (runRequests.length == 0) {
      alert("You must select at least one target to run.");
      return;
    }

    // Prepare request object
    var title = $("#page-aggregation-runner input[name=aggregationTitle]").val();
    var name = $("#page-aggregation-runner input[name=aggregationName]").val() || $("#page-aggregation-runner input[name=aggregationTitle]").val();
    var req = {
       type: "viewBugCheck",
       data: {
          kind: $("#page-aggregation-runner input[name=aggregateOnly]").is(":checked:enabled") ? "aggregate-only" : "run",
          stress: {
            type: $("#page-aggregation-runner input[name=stressTestingRadios]:checked").val(),
            configurations: $("#page-aggregation-runner input[name=stressTestingRadios]:checked").val() != "SINGLE" ? [] : $("#page-aggregation-runner input[name=stressTestingSingleConfiguration]").val(),
            limit: $("#page-aggregation-runner input[name=stressTestingExhaustiveLimit]").val(),
            seeds: $("#page-aggregation-runner input[name=stressTestingExhaustiveSeeds]").val(),
            minimize: {
              lowerBound: $("#page-aggregation-runner input[name=stressTestingMinimizeLowerBound]").val(),
              upperBound: $("#page-aggregation-runner input[name=stressTestingMinimizeUpperBound]").val()
            },
            eventTypes: $("#page-aggregation-runner input[name=stressTestingRadios]:checked").val() == "NONE" ? [] : $("#page-aggregation-runner select[name=stressTestingEventType]").val()
          },
          superGraphMode: $("#page-aggregation-runner input[name=superGraphMode]").is(":checked:enabled"),
          graphType: $("#page-aggregation-runner input[name=graphType]:checked").val(),
          ignoreNoEffectMode: $("#page-aggregation-runner input[name=ignoreNoEffectMode]").is(":checked:enabled"),
          usedServicesMode: $("#page-aggregation-runner input[name=usedServicesMode]").is(":checked:enabled"),
          randomInjectionMode: $("#page-aggregation-runner input[name=randomInjectionMode]").is(":checked:enabled"),
          replay: $("#page-aggregation-runner input[name=replay]").is(":checked:enabled"),
          snapshot: $("#page-aggregation-runner input[name=snapshot]").is(":checked:enabled"),
          collapse: $("#page-aggregation-runner input[name=collapse]").is(":checked:enabled"),
          stopOnError: $("#page-aggregation-runner input[name=stopOnError]").is(":checked:enabled"),
          applicationId: $("#page-aggregation-runner input[name=applicationRadios]:checked").val(),
          tasks: runRequests,
          log: $("#page-aggregation-runner input[name=log]").is(":checked:enabled"),
          logFilter: $("input[name=logFilter]").val()
       }
    };

    var repetitions = parseInt($("#page-aggregation-runner select[name=aggregationRepetitions]").val());
    for (var repetition = 1; repetition <= repetitions; repetition++) {
      // Sending request
      req.data.title = title + "-" + id(req) + "-" + repetition;
      req.data.name  = name  + "-" + id(req) + "-" + repetition;
      $.ajax({
        url: queueServerAjaxURL,
        data: req,
        type: "POST",
        success: function(data) {
          $("html, body").animate({ scrollTop: 0 }, 500, function() {
            if (data.message == "job created") {
              if (listenForIds.indexOf(data.id) == -1) {
                $("#messages-aggregation-runner").prepend(
                  $("<p id='job-" + data.id + "' class='bg-waiting'>Job id: " + data.id + ".</p>")
                  .dblclick(function() {
                    $(this).remove();
                    var listenIndex = listenForIds.indexOf(data.id);
                    if (listenIndex >= 0) {
                      listenForIds.remove(listenIndex);
                    }
                  })
                );
                listenForIds.push(data.id);
              }
            } else {
              $("#messages-aggregation-runner").prepend(
                $("<p class='bg-danger'>Error creating job (message: " + data.message + ").</p>")
                .dblclick(function() {
                  $(this).remove()
                })
              );
            }
          });
        },
        error: function(data) {
          $("#messages-aggregation-runner").prepend($("<p class='bg-danger'>Error creating job</p>"));
        }
      });
    }
  });

  $("#replay-continue").click(function() {
    $.ajax({
      url: execCmdURL + "?type=replay-continue",
      type: "POST"
    });
  });

  $("#event-type-fire").click(function() {
    var eventType = $("#page-aggregation-runner select[name=stressTestingEventType]").val();
    $.ajax({
      url: execCmdURL + "?type=event-type-fire&event=" + eventType,
      type: "POST"
    });
  });
});