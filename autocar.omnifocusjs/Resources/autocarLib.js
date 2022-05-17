/* global PlugIn, flattenedTags, settings, app, Device, inbox, Formatter, Task, Form, Calendar, Tag, Version, tagsMatching, Alert */

;(() => {
    "use strict"
    const piLib = new PlugIn.Library(this.version) // version of the entire plug-in

    piLib.process = (tasks, pluginSettingsInput) => {
        const options = processSettings()
        processTasks()

        function processSettings() {
            if (!pluginSettingsInput.waitTagName) {
                // use default, since there must be a waiting tag to fall back on if waitTagID is invalid
                delete pluginSettingsInput.waitTagName
            }
            if (pluginSettingsInput.noteLink === true) {
                // in plug-in settings, true means use the default note link
                delete pluginSettingsInput.noteLink
            }

            const pluginSettings = {
                ...piLib.defaults(),
                ...pluginSettingsInput,
            }

            function reappliedTagsFilter() {
                if (anArray(pluginSettings.reappliedTagsFilter).length) {
                    const rtags = anArray(pluginSettings.reappliedTagsFilter)
                        .map((idOrName) => getTag(idOrName))
                        .filter((i) => i)
                    return rtags.length && addDescendents(rtags)
                }
            }

            function taskNameRules(input) {
                const a = anArray(input).filter((i) => i !== undefined)
                if (!a.some((i) => i === "")) {
                    a.push("")
                }
                function regExpRule(pattern, replace) {
                    return (task) => {
                        if (pattern.test(task.name)) {
                            return task.name.replace(pattern, replace)
                        }
                    }
                }
                const rules = a
                    .filter(
                        (a) =>
                            !Array.isArray(a) ||
                            (Array.isArray(a) && a.length === 2)
                    )
                    .map((r) => {
                        let o = {}
                        if (Array.isArray(r)) {
                            if (typeof r[0] === "function") {
                                o.run = r[0]
                                o.replace = r[1]
                                    ? String(r[1])
                                    : "(custom rule)"
                            } else {
                                o.pattern =
                                    r[0] instanceof RegExp
                                        ? r[0]
                                        : new RegExp(r[0])
                                o.replace = r[1]
                                o.run = regExpRule(r[0], r[1])
                            }
                        } else if (typeof r === "function") {
                            o.run = r
                            o.replace = "(custom rule)"
                        } else {
                            o.prefixLabel = String(r)
                            o.pattern = /(.*)/
                            o.replace = String(r) + "$1"
                            o.run = regExpRule(o.pattern, o.replace)
                        }
                        return o
                    })
                return rules
            }

            const processedPluginSettings = {
                applyWaitTag: Boolean(pluginSettings.applyWaitTag),
                placeWaitTagFirst: Boolean(pluginSettings.placeWaitTagFirst),
                reapplyTags: Boolean(pluginSettings.reapplyTags),
                reappliedTagsFilter: reappliedTagsFilter(), // array of Tag, or null
                taskNameRules: taskNameRules(pluginSettings.taskNameRules),
                noteLink: ((l) => (typeof l === "boolean" ? l : String(l)))(
                    pluginSettings.noteLink
                ),
                transferNote: Boolean(pluginSettings.transferNote),
                deferDate: pluginSettings.setDeferDate
                    ? futureDate(
                          pluginSettings.deferDaysLater,
                          settings.objectForKey("DefaultStartTime")
                      )
                    : null,
                dueDate: pluginSettings.setDueDate
                    ? futureDate(
                          pluginSettings.dueDaysLater,
                          settings.objectForKey("DefaultDueTime")
                      )
                    : null,
                waitTaskPosition: String(pluginSettings.waitTaskPosition),
                iPadShowDialog:
                    pluginSettings.iPadShowDialog === undefined
                        ? pluginSettings.iOSShowDialog
                        : pluginSettings.iPadShowDialog,
            }

            const options = { ...pluginSettings, ...processedPluginSettings }

            return options

            function anArray(x) {
                return Array.isArray(x) ? x : [x]
            }

            function getTag(idOrName) {
                return idOrName && getOrCreateTag(idOrName, idOrName)
            }

            function addDescendents(arrayTags) {
                // Return a flat array of the tags and all their descendants, without duplicates
                const arrayWithDescs = arrayTags.flatMap((t) =>
                    t ? [t, Array.from(t.flattenedTags)].flat() : []
                )
                return [...new Set(arrayWithDescs)]
            }
        }

        function processTasks() {
            const useForm = (() => {
                const isKeyDown =
                    app[options.modifierKey.toLowerCase() + "KeyDown"]
                return ((d) => (isKeyDown ? !d : d))(
                    Device.current.mac
                        ? options.macShowDialog
                        : Device.current.iPad
                        ? options.iPadShowDialog
                        : options.iOSShowDialog
                )
            })()

            if (useForm) {
                const formInitialValues = {
                    deferDate: options.setDeferDateInDialog
                        ? futureDate(
                              options.deferDaysLater,
                              settings.objectForKey("DefaultStartTime")
                          )
                        : null,
                    dueDate: options.setDueDateInDialog
                        ? futureDate(
                              options.dueDaysLater,
                              settings.objectForKey("DefaultDueTime")
                          )
                        : null,
                }
                showForm(tasks, { ...options, ...formInitialValues })
            } else {
                modifyTasks(tasks, getOrCreateWaitTag(), options)
            }

            function modifyTasks(completeTasks, waitTag, options) {
                const waitTasks = []
                function runRules(task, rules) {
                    for (let r of rules) {
                        const result = r.run(task)
                        if (result) return result
                    }
                    return task.name
                }
                function position(task) {
                    const project = task.containingProject || inbox

                    switch (options.waitTaskPosition) {
                        case "outsideSequences": {
                            const hsq = highestSequentialParent(task)
                            if (hsq) {
                                if (hsq.project) {
                                    // is root task of project
                                    return hsq.ending
                                } else {
                                    return hsq.after
                                }
                            } else {
                                return task.after
                            }
                        }
                        case "projectEnd":
                            return project.ending
                        default:
                            return task.after
                    }
                }
                function noteLink(task) {
                    try {
                        // 'link' and 'timestamp()' can be used in the 'noteLink' setting string
                        // eslint-disable-next-line no-unused-vars
                        const link = `${app.name.toLowerCase()}:///task/${
                            task.id.primaryKey
                        }`
                        // eslint-disable-next-line no-unused-vars
                        function timestamp(date, time) {
                            const styles = ["Short", "Medium", "Long", "Full"]
                            let dateStyle, timeStyle, custom
                            if (date) {
                                if (styles.includes(date)) {
                                    dateStyle = Formatter.Date.Style[date]
                                } else {
                                    custom = date
                                }
                                if (styles.includes(time)) {
                                    timeStyle = Formatter.Date.Style[time]
                                }
                            } else {
                                custom = "E d MMM, HH:mm"
                            }
                            const df = custom
                                ? Formatter.Date.withFormat(custom)
                                : Formatter.Date.withStyle(dateStyle, timeStyle)
                            return df.stringFromDate(new Date())
                        }
                        return eval("`" + options.noteLink + "`")
                        // eslint-disable-next-line no-empty
                    } catch {}
                }

                try {
                    completeTasks.forEach((t) => {
                        const name = runRules(t, options.taskNameRules)

                        const w = new Task(name, position(t))
                        waitTasks.push(w)

                        function doAddWaitTag() {
                            options.applyWaitTag && waitTag && w.addTag(waitTag)
                        }
                        function doReapplyTags() {
                            if (options.reapplyTags) {
                                const tags = options.reappliedTagsFilter
                                    ? t.tags.filter((t) =>
                                          options.reappliedTagsFilter.includes(
                                              t
                                          )
                                      )
                                    : t.tags
                                w.addTags(tags)
                            }
                        }
                        const fs = [doReapplyTags, doAddWaitTag]
                        if (options.placeWaitTagFirst) fs.reverse()
                        fs.forEach((f) => f())

                        if (options.deferDate) w.deferDate = options.deferDate
                        if (options.dueDate) w.dueDate = options.dueDate

                        if (options.noteLink) {
                            const note = noteLink(t)
                            if (note) {
                                w.note = note
                            }
                        }
                        if (options.transferNote && t.note) {
                            const spacing = w.note
                                ? "\n" + options.noteInterline
                                : ""
                            w.appendStringToNote(spacing + t.note)
                        }

                        t.markComplete()
                    })
                } catch (e) {
                    let msg =
                        "The plug-in encountered an error when updating actions.\n\n" +
                        `${waitTasks.length} action${
                            waitTasks.length == 1 ? "" : "s"
                        } created.`
                    if (waitTasks.length) {
                        msg +=
                            "\n\nUse the Undo command in the Edit menu to revert changes."
                    }
                    piLib.errorAlert(msg, e)
                } finally {
                    // On iOS, cannot detect if Edit mode is active; assume it's not if only 1 task selected
                    if (Device.current.mac || tasks.length > 1) {
                        document.windows[0].selectObjects(waitTasks)
                    }
                }
            }

            async function showForm(tasks, options) {
                const title = ((count) =>
                    `${count == 1 ? "" : count + " "}New Action${
                        count == 1 ? "" : "s"
                    }`)(tasks.length)
                const waitTag = getOrCreateWaitTag()

                const taskNameField = (() => {
                    const taskNameFieldOptions = (() => {
                        const rules = options.taskNameRules
                        rules.forEach((r) => {
                            r.matchCount = 0
                            r.topMatchCount = 0
                        })
                        ;(function setCounts() {
                            tasks.forEach((task) => {
                                let topMatchFound = false
                                rules.forEach((rule) => {
                                    if (rule.run(task)) {
                                        rule.matchCount += 1
                                        if (!topMatchFound) {
                                            rule.topMatchCount += 1
                                            topMatchFound = true
                                        }
                                    }
                                })
                            })
                        })()

                        const sameTopMatch = (() => {
                            let sameTopMatch = false
                            const multiple = tasks.length > 1
                            rules.forEach((rule) => {
                                if (multiple && rule.prefixLabel == "") {
                                    rule.fieldLabel = "(same names)"
                                } else {
                                    rule.fieldLabel = multiple
                                        ? rule.replace.replace(
                                              /\$(\d|({|<).+?(}|>))/g,
                                              "…"
                                          )
                                        : rule.run(tasks[0])
                                }
                                sameTopMatch =
                                    sameTopMatch ||
                                    rule.topMatchCount == tasks.length
                            })
                            return sameTopMatch
                        })()

                        function rulesInField() {
                            let rulesInField = rules.filter(
                                (r) => r.matchCount == tasks.length
                            )
                            if (!sameTopMatch) {
                                const count = rules.filter(
                                    (r) => r.topMatchCount
                                ).length
                                const autoLabel = `(Automatic: ${count} patterns)`
                                rulesInField.unshift({
                                    auto: true,
                                    fieldLabel: autoLabel,
                                })
                            }
                            return rulesInField
                        }

                        return rulesInField()
                    })()

                    function shorten(str, length) {
                        return str.length <= length
                            ? str
                            : str.substring(0, length - 1) + "…"
                    }
                    const taskNameFieldOptionLabels = taskNameFieldOptions.map(
                        (i) => shorten(i.fieldLabel, 65)
                    )
                    const taskNameFieldLabel = `Name${
                        tasks.length > 1 ? "s" : ""
                    }`

                    return new Form.Field.Option(
                        "taskNameRules",
                        taskNameFieldLabel,
                        taskNameFieldOptions,
                        taskNameFieldOptionLabels,
                        taskNameFieldOptions[0]
                    )
                })()

                const reapplyTagsField = (() => {
                    let labelPluralTag = true,
                        labelEndColon = false,
                        strTagsList = ""
                    function label() {
                        return `Apply tag${
                            labelPluralTag ? "s" : ""
                        } of the completed action${
                            tasks.length > 1 ? "s" : ""
                        }${labelEndColon ? ": " : ""}\n${strTagsList}`
                    }
                    const completedTasksHaveTags =
                        tasks.reduce((n, t) => (n += t.tags.length), 0) > 0

                    let showField = completedTasksHaveTags
                    if (completedTasksHaveTags && options.reappliedTagsFilter) {
                        const tagsOfTasks = Array.from(
                            tasks.map((t) => Array.from(t.tags))
                        ).flat()
                        const reappliedTags =
                            options.reappliedTagsFilter.filter((t) =>
                                tagsOfTasks.includes(t)
                            )
                        if (reappliedTags.length) {
                            labelPluralTag = reappliedTags.length > 1
                            if (Device.current.mac) {
                                // OF forms on iOS only display 1 row
                                labelEndColon = true
                                strTagsList = reappliedTags
                                    .reduce((str, t) => str + t.name + ", ", "")
                                    .slice(0, -2)
                            }
                        } else {
                            showField = false
                        }
                    }

                    if (showField) {
                        return new Form.Field.Checkbox(
                            "reapplyTags",
                            label(),
                            options.reapplyTags
                        )
                    }
                })()

                const transferNotesField = (() => {
                    if (tasks.some((t) => t.note)) {
                        const plural = tasks.length > 1 ? "s" : ""
                        const label = `Transfer the note${plural} of the completed action${plural}`
                        return new Form.Field.Checkbox(
                            "transferNote",
                            label,
                            options.transferNote
                        )
                    }
                })()

                const waitTaskPositionField = (() => {
                    if (
                        options.waitTaskPosition != "projectEnd" &&
                        tasks.some((t) => highestSequentialParent(t))
                    ) {
                        const opt = ["normal", "outsideSequences"]
                        const optLabel = [
                            "Normal",
                            "Optional, don't block sequential actions",
                        ]
                        const optDefault =
                            options.waitTaskPosition == "outsideSequences"
                                ? opt[1]
                                : opt[0]
                        return new Form.Field.Option(
                            "waitTaskPosition",
                            "Response Type",
                            opt,
                            optLabel,
                            optDefault
                        )
                    }
                })()

                const form = (() => {
                    const f = new Form()
                    f.addField(taskNameField)
                    reapplyTagsField && f.addField(reapplyTagsField)
                    waitTag &&
                        f.addField(
                            new Form.Field.Checkbox(
                                "applyWaitTag",
                                "Add tag: " + waitTag.name,
                                options.applyWaitTag
                            )
                        )
                    f.addField(
                        new Form.Field.Date(
                            "deferDate",
                            "Defer date",
                            options.deferDate
                        )
                    )
                    f.addField(
                        new Form.Field.Date(
                            "dueDate",
                            "Due date",
                            options.dueDate
                        )
                    )
                    transferNotesField && f.addField(transferNotesField)
                    waitTaskPositionField && f.addField(waitTaskPositionField)
                    return f
                })()

                const formResult = await form.show(title, "OK")

                const formChoices = {}
                formResult.fields.forEach((fld) => {
                    formChoices[fld.key] = formResult.values[fld.key]
                })
                const taskNameRules = {
                    taskNameRules: formChoices.taskNameRules.auto
                        ? options.taskNameRules
                        : [formChoices.taskNameRules],
                }

                modifyTasks(tasks, waitTag, {
                    ...options,
                    ...formChoices,
                    ...taskNameRules,
                })
            }

            function getOrCreateWaitTag() {
                return getOrCreateTag(
                    options.waitTagID,
                    options.waitTagName,
                    true
                )
            }

            function highestSequentialParent(task) {
                let hsq
                function checkParent(task) {
                    const p = task.parent
                    if (p) {
                        if (p.sequential) {
                            hsq = p
                        }
                        checkParent(p)
                    }
                }
                checkParent(task)
                return hsq
            }
        }

        function futureDate(dueInDays, strTime) {
            const date = Calendar.current.startOfDay(new Date())
            const days = Number(dueInDays) ? dueInDays : 1
            const arrTime = strTime
                .split(":")
                .slice(0, 2)
                .map((s) => Number(s))
            date.setTime(
                date.getTime() +
                    (days * 24 * 3600 + arrTime[0] * 3600 + arrTime[1] * 60) *
                        1000
            )
            return date
        }

        function getOrCreateTag(fromId, fromTagName, createIfMissing = false) {
            // allow passing either an ID or a tag URL
            const id = fromId.replace(/^omnifocus:\/\/\/tag\/(.+)/, "$1")

            function forID() {
                return id && Tag.byIdentifier(String(id))
            }
            function exactName() {
                return fromTagName && flattenedTags.byName(String(fromTagName))
            }
            function nearestName() {
                return fromTagName && tagsMatching(String(fromTagName))[0]
            }
            function create() {
                // avoid creating an untitled tag if fromTagName is ''
                if (createIfMissing && fromTagName) {
                    piLib.log(
                        "INFO",
                        `Could not find a specified tag based on ID or name, created new tag '${fromTagName}'.`
                    )
                    return new Tag(String(fromTagName))
                }
            }

            return forID() || exactName() || nearestName() || create()
        }
    }

    piLib.defaults = function () {
        return {
            waitTagID: "",
            waitTagName: "waiting",
            applyWaitTag: true,
            placeWaitTagFirst: false,
            reapplyTags: false,
            reappliedTagsFilter: [],
            noteLink: "${timestamp()} — completed: ${link}",
            noteInterline: "", // eg. '\n'
            transferNote: true,
            waitTaskPosition: "normal", // 'normal', 'outsideSequences', or 'projectEnd'
            setDeferDate: false,
            setDeferDateInDialog: true,
            deferDaysLater: 5,
            setDueDate: false,
            setDueDateInDialog: true,
            dueDaysLater: 7,
            macShowDialog: false,
            iPadShowDialog: undefined, // new option in v1.3; make compatibile with older settings files having iOSShowDialog=true for all iOS/iPadOS devices
            iOSShowDialog: false,
            modifierKey: "option",
            taskNameRules: ["Waiting for response: "],
        }
    }

    piLib.minAppVersions = {
        mac: { build: "149.5", user: "3.11.1" },
        ios: { build: "148.5", user: "3.11.2" },
    }

    piLib.appVersionCheck = function () {
        let platform
        if (Device.current.mac) {
            platform = "mac"
        } else if (Device.current.iOS) {
            platform = "ios"
        }
        const minVersion = piLib.minAppVersions[platform].build

        let currentVersion
        try {
            currentVersion = app.buildVersion
        } catch {
            // deprecated property available in OmniFocus builds prior to 149.7.0
            currentVersion = new Version(app.version)
        }
        return currentVersion.atLeast(new Version(minVersion))
    }

    piLib.log = function (level, message, error) {
        const pi = piLib.plugIn
        const output =
            `[Plug-in: ${pi.displayName} (${
                pi.identifier
            }) — ${level} ${new Date().toLocaleString()}]` +
            "\n" +
            `${message}` +
            (error ? "\n" + `(${error})` : "")
        console.log(output)
    }

    piLib.errorAlert = function (message, error) {
        piLib.log("ERROR", message, error)
        new Alert("Error", message).show()
    }

    return piLib
})()
