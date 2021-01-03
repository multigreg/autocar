(() => {
    'use strict';
    const piLib = new PlugIn.Library(this.version)  // version of the entire plug-in
    
    piLib.process = (tasks, pluginSettingsInput) => {
        try {
            if(!pluginSettingsInput.waitTagName) {
                delete pluginSettingsInput.waitTagName
            }
            const pluginSettings = { ...defaults(), ...pluginSettingsInput}
            let options, formInitialValues

            (function prepare() {
                const reappliedTagsFilter = () => {
                    if(anArray(pluginSettings.reappliedTagsFilter).length) {
                        const rtags = anArray(pluginSettings.reappliedTagsFilter).map(idOrName => getTag(idOrName)).filter(i => i)
                        return rtags.length && addDescendents(flattenedTags.filter(t => rtags.includes(t)))
                    }
                }

                const taskNameRules = (input) => {
                    const a = anArray(input)
                    if(!a.some(i => i === '')) {
                        a.push('')
                    }
                    const rules = a.map(r => {
                        let o = {}
                        if(Array.isArray(r)) {
                            o.pattern = (r[0] instanceof RegExp) ? r[0] : new RegExp(r[0])
                            o.replace = r[1]
                        } else {
                            o.prefixLabel = String(r)
                            o.pattern = /(.*)/
                            o.replace = String(r) + '$1'
                        }
                        return o
                    })
                    return rules
                }

                options = {
                    applyWaitTag: Boolean(pluginSettings.applyWaitTag),
                    placeWaitTagFirst: Boolean(pluginSettings.placeWaitTagFirst),
                    reapplyTags: Boolean(pluginSettings.reapplyTags),
                    reappliedTagsFilter: reappliedTagsFilter(),  // array of Tag, or null
                    taskNameRules: taskNameRules(pluginSettings.taskNameRules),
                    noteLink: ((l) => (typeof l === 'boolean' ) ? Boolean(l) : String(l))(pluginSettings.noteLink),
                    deferDate: pluginSettings.setDeferDate ? futureDate(pluginSettings.deferDaysLater, settings.objectForKey('DefaultStartTime')) : null,
                    dueDate: pluginSettings.setDueDate ? futureDate(pluginSettings.dueDaysLater, settings.objectForKey('DefaultDueTime')) : null,
                    waitTaskPosition: String(pluginSettings.waitTaskPosition)
                }
                formInitialValues = {
                    deferDate: pluginSettings.setDeferDateInDialog ? futureDate(pluginSettings.deferDaysLater, settings.objectForKey('DefaultStartTime')) : null,
                    dueDate: pluginSettings.setDueDateInDialog ? futureDate(pluginSettings.dueDaysLater, settings.objectForKey('DefaultDueTime')) : null, 
                }
            })()
            
            const isKeyDown = app[pluginSettings.modifierKey.toLowerCase() + 'KeyDown'] 
            if((d => isKeyDown ? !d : d)(Device.current.mac ? pluginSettings.macShowDialog : pluginSettings.iOSShowDialog)) {
                showForm(tasks, { ...options, ...formInitialValues })
            } else {
                modifyTasks(tasks, getOrCreateWaitTag(), options)
            }
            
            function modifyTasks(completeTasks, waitTag, options) {
                const waitTasks = []
                const runRules = (name, rules) => {
                        for(let r of rules) {
                            if(r.pattern.test(name)) {
                                return name.replace(r.pattern, r.replace)
                            }
                        }
                        return name
                }
                const position = (task) => {
                    const project = task.containingProject || inbox

                    switch(options.waitTaskPosition) {
                    case 'outsideSequences':
                        const hsq = highestSequentialParent(task)
                        if(hsq) {
                            if(hsq.project) {  // is root task of project
                                return hsq.ending
                            } else {
                                return hsq.after
                            }
                        } else {
                            return task.after
                        }
                    case 'projectEnd':
                        return project.ending
                    default:
                        return task.after
                    }
                }

                try {
                    completeTasks.forEach(t => {
                        const name = runRules(t.name, options.taskNameRules)

                        const w = new Task(name, position(t))
                        waitTasks.push(w)
                        
                        const doAddWaitTag = () => options.applyWaitTag && waitTag && w.addTag(waitTag)
                        const doReapplyTags = () => {
                            if(options.reapplyTags) {
                                const tags = options.reappliedTagsFilter ? t.tags.filter(t => options.reappliedTagsFilter.includes(t)) : t.tags
                                w.addTags(tags)
                            }
                        }
                        const fs = [doReapplyTags, doAddWaitTag]
                        if(options.placeWaitTagFirst) fs.reverse()
                        fs.forEach(f => f())
                        
                        if(options.deferDate) w.deferDate = options.deferDate
                        if(options.dueDate) w.dueDate = options.dueDate
                        if(options.noteLink) {
                            const prefix = (options.noteLink === true) ? '' : options.noteLink
                            w.note = `${prefix} ${app.name.toLowerCase()}:///task/${t.id.primaryKey}`
                        }

                        t.markComplete()
                    })
                } catch(e) {
                    piLib.errorAlert(e, `The plug-in encountered an error when updating actions.\n\n${waitTasks.length} actions created.\n\nUse the Undo command in the Edit menu to revert changes.`)
                } finally {
                    // On iOS, cannot detect if Edit mode is active; assume it's not if only 1 task selected
                    if(Device.current.mac || tasks.length > 1) {
                        document.windows[0].selectObjects(waitTasks)
                    }
                }
            }

            function showForm(tasks, options) {
                const title = (count => `${count == 1 ? '' : count + ' '}New Action${count == 1 ? '' : 's'}`)(tasks.length)
                const waitTag = getOrCreateWaitTag()

                const taskNameField = (() => {
                    const taskNameFieldOptions = (() => {
                        const rules = options.taskNameRules
                        rules.forEach(r => {
                            r.matchCount = 0
                            r.topMatchCount = 0
                        })
    
                        const setCounts = (() => {
                            tasks.forEach(task => {
                                let topMatchFound = false
                                rules.forEach(rule => {
                                    if(rule.pattern.test(task.name)) {
                                        rule.matchCount += 1
                                        if(!topMatchFound) {
                                            rule.topMatchCount += 1
                                            topMatchFound = true
                                        }
                                    }
                                })
                            })
                        })()
                        
                        const sameTopMatch = (() => {
                            let sameTopMatch = false
                            const multiple = (tasks.length > 1) 
                            rules.forEach(rule => {
                                if(multiple && rule.prefixLabel == '') {
                                    rule.fieldLabel = '(same names)'
                                } else {
                                    rule.fieldLabel = multiple ? rule.replace.replace(/\$\d/g, '…') : tasks[0].name.replace(rule.pattern, rule.replace)
                                }
                                sameTopMatch = sameTopMatch || (rule.topMatchCount == tasks.length)
                            })
                            return sameTopMatch
                        })()
    
                        const rulesInField = () => {
                            let rulesInField = rules.filter(r => r.matchCount == tasks.length)
                            if(!sameTopMatch) {
                                const count = rules.filter(r => r.topMatchCount).length
                                const autoLabel = `(Automatic: ${count} patterns)`
                                rulesInField.unshift( { auto: true, fieldLabel: autoLabel })
                            }
                            return rulesInField
                        }
                            
                        return rulesInField()
                    })()

                    const shorten = (str, length) => (str.length <= length) ? str : str.substring(0, length - 1) + '…'
                    const taskNameFieldOptionLabels = taskNameFieldOptions.map(i => shorten(i.fieldLabel, 50))
                    const taskNameFieldLabel = `Name${tasks.length > 1 ? 's' : ''}`
                    
                    return new Form.Field.Option(
                        'taskNameRules', taskNameFieldLabel,
                        taskNameFieldOptions, taskNameFieldOptionLabels,
                        taskNameFieldOptions[0]
                        )
                })()
                
                const reapplyTagsField = (() => {
                    let labelPluralTag = true, labelEndColon = false, strTagsList = ''
                    const label = () => `Apply tag${labelPluralTag ? 's' : ''} of the completed action${tasks.length > 1 ? 's' : ''}${labelEndColon ? ': ' : ''}${strTagsList}`
                    const completedTasksHaveTags = tasks.reduce((n, t) => n += t.tags.length, 0) > 0
                    
                    let showField = completedTasksHaveTags
                    if(completedTasksHaveTags && options.reappliedTagsFilter) {
                        const tagsOfTasks = Array.from(tasks.map(t => Array.from(t.tags))).flat()
                        const reappliedTags = options.reappliedTagsFilter.filter(t => tagsOfTasks.includes(t))
                        if(reappliedTags.length) {
                            labelPluralTag = reappliedTags.length > 1
                            if(Device.current.mac) { // OF forms on iOS only display 1 row
                                labelEndColon = true
                                strTagsList = reappliedTags.reduce((str, t) => str + t.name + ', ', '').slice(0, -2)
                                // If label is >35 characters, wrap so that the form doesn't automatically grow too wide
                                if(label().length + strTagsList.length > 35) strTagsList = '\n' + strTagsList
                            }
                        } else {
                            showField = false
                        }
                    } 
                    
                    if(showField) {
                        return new Form.Field.Checkbox('reapplyTags', label(), options.reapplyTags)
                    }
                })()
                
                const waitTaskPositionField = (() => {
                    if(options.waitTaskPosition != 'projectEnd' && tasks.some(t => highestSequentialParent(t))) {
                        const opt = ['normal', 'outsideSequences']
                        const optLabel = [ 'Normal', "Optional, don't block sequential actions"]
                        const optDefault = options.waitTaskPosition == 'outsideSequences' ? opt[1] : opt[0]
                        return new Form.Field.Option(
                            'waitTaskPosition', 'Response Type',
                            opt, optLabel,
                            optDefault
                        )
                    }
                })()
                
                const form = (() => {
                    const f = new Form()
                    f.addField(taskNameField)
                    reapplyTagsField && f.addField(reapplyTagsField)
                    waitTag && f.addField(new Form.Field.Checkbox('applyWaitTag', 'Add tag: ' + waitTag.name, options.applyWaitTag))
                    f.addField(new Form.Field.Date('deferDate', 'Defer date', options.deferDate))
                    f.addField(new Form.Field.Date('dueDate', 'Due date', options.dueDate))
                    waitTaskPositionField && f.addField(waitTaskPositionField)
                    return f
                })()

                form.show(title, 'OK')
                    .then(form => {
                        const formChoices = {}
                        form.fields.forEach(fld => {
                            formChoices[fld.key] = form.values[fld.key]
                        })
                        const autoRules = formChoices.taskNameRules && formChoices.taskNameRules.auto && { taskNameRules: options.taskNameRules }
                        if(formChoices.taskNameRules) formChoices.taskNameRules = anArray(formChoices.taskNameRules)
                        
                        modifyTasks(tasks, waitTag, { ...options, ...formChoices, ...autoRules })
                    })
            }

            function anArray(x) { 
                return Array.isArray(x) ? x : [x]
            }

            function futureDate(dueInDays, strTime) {
                const date = Calendar.current.startOfDay(new Date())
                const days = Number(dueInDays) ? dueInDays : 1
                const arrTime = strTime.split(':').slice(0,2).map(s => Number(s))
                date.setTime(date.getTime() + (days * 24 * 3600 + arrTime[0] * 3600 + arrTime[1] * 60) * 1000)
                return date
            }

            function getTag(idOrName) {
                return idOrName && getOrCreateTag(idOrName, idOrName)
            }

            function getOrCreateTag(fromId, fromTagName, createIfMissing = false) {
                const id = fromId.replace(/^omnifocus:\/\/\/tag\/(.+)/, '$1')
                const forID = () => id && Tag.byIdentifier(String(id))
                const exactName = () => fromTagName && flattenedTags.byName(String(fromTagName))
                const nearestName = () => fromTagName && tagsMatching(String(fromTagName))[0]
                const create = () => {
                    if(createIfMissing && fromTagName) {  // avoid creating an untitled tag if fromTagName is ''
                        const pi = piLib.plugIn
                        console.log(`Plug-in ${pi.displayName} (ID: ${pi.identifier}) could not find a specified tag based on ID or name, created new tag '${fromTagName}'.`)
                        return new Tag(String(fromTagName))
                    }
                }
                
                return forID() || exactName() || nearestName() || create()
            }
            
            function getOrCreateWaitTag() {
                return getOrCreateTag(pluginSettings.waitTagID, pluginSettings.waitTagName, true)
            }

            function addDescendents(arrayTags) {
                // Return a flat array of the tags and all their descendants, without duplicates
                const arrayWithDescs = arrayTags.flatMap(t => t ? [t, Array.from(t.flattenedTags)].flat() : [])
                return [...new Set(arrayWithDescs)]
            }

            function highestSequentialParent(task) {
                let hsq
                function checkParent(task) {
                    const p = task.parent
                    if(p) {
                        if(p.sequential) {
                            hsq = p
                        }
                        checkParent(p)
                    }
                }
                checkParent(task)
                return hsq
            }

            function defaults() {
                return {
                    waitTagID: '',
                    waitTagName: 'waiting',
                    applyWaitTag: true,
                    placeWaitTagFirst: false,
                    reapplyTags: false,
                    reappliedTagsFilter: [],
                    taskNameRules: ['Wait for response: '],
                    noteLink: 'Created on completion of:',
                    waitTaskPosition: 'normal',  // 'normal', 'outsideSequences', or 'projectEnd'
                    setDeferDate: false,
                    setDeferDateInDialog: true,
                    deferDaysLater: 5,
                    setDueDate: false,
                    setDueDateInDialog: true,
                    dueDaysLater: 7,
                    macShowDialog: false,
                    iOSShowDialog: false,
                    modifierKey: 'option'
                }
            }

        } catch(e) {
            piLib.errorAlert(e, 'The plug-in encountered an error. No changes to actions were made.')
        }
    }
    
    piLib.minAppVersions = {
        mac: { version: '149.5', release: '3.11.1' },
        ios: { version: '148.5', release: '3.11.2' }
    }
    
    piLib.appVersionCheck = function() {
        let minVersion = 0
        if(Device.current.mac) {
            minVersion = piLib.minAppVersions.mac.version
        } else if(Device.current.iOS) {
            minVersion = piLib.minAppVersions.ios.version
        }
        return new Version(app.version).atLeast(new Version(minVersion))
    }
    
    piLib.errorAlert = function(error, message) {
        const pi = piLib.plugIn
        console.log(`Plug-in ${pi.displayName} (ID: ${pi.identifier}):`)
        console.log(error)
        console.log(message)
        new Alert('Error', message).show()
    }
    
    return piLib

})()