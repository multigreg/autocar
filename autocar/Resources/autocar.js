(() => {
    'use strict'
    const action = new PlugIn.Action(function(selection) {
        const settingsFile = 'settings.js'
        const plugin = this.plugIn
        const pLib = this.autocarLib

        try {
            if(!pLib.appVersionCheck()) {
                throw 100
            }
            
            plugin.resourceNamed(settingsFile).fetch(data => {
                try {
                    const strJs = data.toString() + '\n;(' + objFromSettingsInput.toString() + ')()'
                    const oSettings = eval(strJs)

                    oSettings && pLib.process(selection.tasks, oSettings)
                } catch(e) {
                    pLib.errorAlert(e, 'Wrong syntax in the settings file of the plug-in.')
                }
            })
            
            function objFromSettingsInput() {
                const s = [
                    'waitTagID', 'waitTagName', 'applyWaitTag', 'placeWaitTagFirst',
                    'reapplyTags', 'reappliedTagsFilter', 'taskNameRules', 'noteLink', 'waitTaskPosition',
                    'setDeferDate', 'setDeferDateInDialog', 'deferDaysLater', 'setDueDate', 'setDueDateInDialog', 'dueDaysLater',
                    'macShowDialog', 'iOSShowDialog', 'modifierKey'
                ]
                const o = {}
                s.forEach(i => {
                    try {
                        o[i] = eval(i)
                    } catch {}
                })
                return o
            }
        } catch(e) {
            switch(e) {
                case 100:
                    const msg = `The ${this.plugIn.displayName} plug-in requires:\n\nOmniFocus for macOS version ${pLib.minAppVersions.mac.release} or later,\nor OmniFocus for iOS version ${pLib.minAppVersions.ios.release} or later.`
                    pLib.errorAlert('Incompatible version of OmniFocus', msg)
                    break
                default:
                    console.log('calling error alert: ' + e)
                    pLib.errorAlert(e, 'Error initializing the plug-in.')
            }
        }
    })
 
    action.validate = selection => {
        const ts = selection.tasks
        return ts.length > 0
            && ts.length === selection.databaseObjects.length   // selection contains tasks only
            && ts.every(t => !(t.taskStatus == Task.Status.Completed || t.taskStatus == Task.Status.Dropped))
    }
 
    return action
})();
