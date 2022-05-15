/* global PlugIn, Task */
"use strict"
;(() => {
    const action = new PlugIn.Action(async function (selection) {
        const plugin = this.plugIn
        const mainLib = plugin.library("autocarLib")
        const ruleLib = plugin.library("ruleLib")
        const settingsLib = plugin.library("settingsLib")

        try {
            if (!mainLib.appVersionCheck()) {
                throw 100
            }

            ruleLib.clearRules()

            let oSettings
            try {
                oSettings = await settingsLib.loadSettings(
                    mainLib.defaults(),
                    "rule",
                    ruleLib.user
                )
                if (!oSettings.taskNameRules) {
                    oSettings.taskNameRules = ruleLib.getRules()
                }
            } catch (e) {
                if (e == 110) throw e
                throw 120
            }

            oSettings && mainLib.process(selection.tasks, oSettings)
        } catch (e) {
            switch (e) {
                case 100: {
                    const msg = `The ${plugin.displayName} plug-in requires:\n\nOmniFocus for macOS version ${mainLib.minAppVersions.mac.user} or later,\nor OmniFocus for iOS version ${mainLib.minAppVersions.ios.user} or later.`
                    mainLib.errorAlert(msg, "Incompatible version of OmniFocus")
                    break
                }
                case 110: {
                    mainLib.errorAlert(
                        "Wrong syntax in the settings file of the plug-in."
                    )
                    break
                }
                case 120: {
                    mainLib.errorAlert("Error initializing the plug-in.")
                    break
                }
                default:
                    mainLib.errorAlert(
                        "The plug-in encountered an error. No changes to actions were made.",
                        e
                    )
            }
        }
    })

    action.validate = (selection) => {
        const ts = selection.tasks
        return (
            ts.length > 0 &&
            ts.length === selection.databaseObjects.length && // selection contains tasks only
            ts.every(
                // remaining tasks only
                (t) =>
                    !(
                        t.taskStatus == Task.Status.Completed ||
                        t.taskStatus == Task.Status.Dropped
                    )
            )
        )
    }

    return action
})()
