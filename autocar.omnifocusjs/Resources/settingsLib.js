/* global PlugIn, Version, FileWrapper, FileSaver, TypeIdentifier, Alert */
// don't use strict code, to avoid explicit variable declaration in settings file

;(() => {
    const dialogPluginName = "Autocar"
    const settingsFileName = setFileName("Autocar settings.txt")

    const plugin = this

    const settingsLib = new PlugIn.Library(new Version("1.0"))

    // A const called libName with value libRef is created in the scope of executing the settings file code
    // eslint-disable-next-line no-unused-vars
    settingsLib.loadSettings = async function (objDefaults, libName, libRef) {
        async function settingsFileData() {
            const packagedSettingsFileURL = plugin.resourceNamed(
                settingsFileName.packaged
            )
            const standaloneSettingsFileURL = packagedSettingsFileURL
                .deletingLastPathComponent()
                .deletingLastPathComponent()
                .deletingLastPathComponent()
                .appendingPathComponent(settingsFileName.standalone)

            let settingsFileData
            try {
                settingsFileData = await fetchFile(standaloneSettingsFileURL)
            } catch (e) {
                settingsFileData = await fetchFile(packagedSettingsFileURL)
            }

            return settingsFileData
        }

        function objFromSettingsInput() {
            const o = {}
            const ks = Object.keys(objDefaults)
            ks.forEach((k) => {
                try {
                    o[k] = eval(k)
                    // eslint-disable-next-line no-empty
                } catch {}
            })
            return o
        }

        const strJs =
            "const " +
            libName +
            " = libRef\n" +
            (await settingsFileData()).toString() +
            "\n;(" +
            objFromSettingsInput.toString() +
            ")()"

        let oSettings
        try {
            oSettings = eval(strJs)
        } catch (e) {
            throw 110
        }

        return oSettings
    }

    settingsLib.settingsFileSaveAs = async () => {
        const uiInfoTitle = "Save the " + dialogPluginName + " settings file"
        const uiInfoMessage =
            "In the next dialog, please navigate to the following folder:"
        const uiSaveAsMessage =
            "Save a copy of the " + dialogPluginName + " settings file"

        const packagedSettingsFileURL = plugin.resourceNamed(
            settingsFileName.packaged
        )
        const requiredDestinationFolder = plugin.URL.deletingLastPathComponent()
        const requiredDestination =
            requiredDestinationFolder.appendingPathComponent(
                settingsFileName.standalone
            )
        const requiredDestinationFolderDisplay = decodeURI(
            requiredDestinationFolder.string
        ).replace(/^file:\/\//, "")

        const alert = new Alert(
            uiInfoTitle,
            uiInfoMessage + "\n\n" + requiredDestinationFolderDisplay
        )
        await alert.show()

        const settingsFileData = await fetchFile(packagedSettingsFileURL)
        const fw = FileWrapper.withContents(
            settingsFileName.standalone,
            settingsFileData
        )

        const fs = new FileSaver()
        fs.message = uiSaveAsMessage
        fs.types = [TypeIdentifier.plainText]
        const fileURL = await fs.show(fw)

        if (fileURL.string != requiredDestination.string) {
            settingsLib.log(
                "INFO",
                "The settings file was not saved in the folder that contains the " +
                    dialogPluginName +
                    " plug-in: \n" +
                    requiredDestinationFolderDisplay +
                    "\n" +
                    "It will not be used when the plug-in runs."
            )
        }
    }

    settingsLib.log = (...args) => {
        const logLib = plugin.library("autocarLib")
        logLib.log(...args)
    }

    function setFileName(packaged = "settings.txt", standalone = packaged) {
        return {
            packaged: packaged,
            standalone: standalone,
        }
    }

    function fetchFile(url) {
        return new Promise((resolve, reject) => {
            try {
                url.fetch(
                    (data) => resolve(data),
                    (err) => reject(err)
                )
            } catch (e) {
                reject(e)
            }
        })
    }

    return settingsLib
})()
