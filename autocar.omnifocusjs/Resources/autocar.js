/* global PlugIn, Task */

;(() => {
    // don't use strict code, to avoid explicit variable declaration in settings file
    const action = new PlugIn.Action(async function (selection) {
        const plugin = this.plugIn
        const mainLib = plugin.library("autocarLib")
        const ruleLib = plugin.library("ruleLib")
        // variable name to use when calling task name rule methods in user-defined settings file
        // eslint-disable-next-line no-unused-vars
        const rule = ruleLib.user

        try {
            if (!mainLib.appVersionCheck()) {
                throw 100
            }

            let oSettings
            try {
                async function loadSettings() {
                    const packagedSettingsFileURL = plugin.resourceNamed(
                        mainLib.packagedSettingsFileName
                    )
                    const standaloneSettingsFileURL = packagedSettingsFileURL
                        .deletingLastPathComponent()
                        .deletingLastPathComponent()
                        .deletingLastPathComponent()
                        .appendingPathComponent(
                            mainLib.standaloneSettingsFileName
                        )

                    let settingsFileData
                    try {
                        settingsFileData = await mainLib.fetchFile(
                            standaloneSettingsFileURL
                        )
                    } catch (e) {
                        settingsFileData = await mainLib.fetchFile(
                            packagedSettingsFileURL
                        )
                    }

                    ruleLib.clearRules()

                    let oSettings
                    try {
                        const strJs =
                            settingsFileData.toString() +
                            "\n;(" +
                            objFromSettingsInput.toString() +
                            ")()"
                        oSettings = eval(strJs)
                    } catch (e) {
                        throw 110
                    }

                    if (!oSettings.taskNameRules) {
                        oSettings.taskNameRules = ruleLib.getRules()
                    }

                    return oSettings

                    function objFromSettingsInput() {
                        const s = [
                            "waitTagID",
                            "waitTagName",
                            "applyWaitTag",
                            "placeWaitTagFirst",
                            "reapplyTags",
                            "reappliedTagsFilter",
                            "noteLink",
                            "noteInterline",
                            "transferNote",
                            "waitTaskPosition",
                            "setDeferDate",
                            "setDeferDateInDialog",
                            "deferDaysLater",
                            "setDueDate",
                            "setDueDateInDialog",
                            "dueDaysLater",
                            "macShowDialog",
                            "iOSShowDialog",
                            "modifierKey",
                            "taskNameRules",
                        ]
                        const o = {}
                        s.forEach((i) => {
                            try {
                                o[i] = eval(i)
                                // eslint-disable-next-line no-empty
                            } catch {}
                        })
                        return o
                    }
                }

                oSettings = await loadSettings()
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
