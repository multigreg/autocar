/* global PlugIn, flattenedTags */

;(() => {
    "use strict"
    const ruleLib = new PlugIn.Library(this.version)

    const rulesArray = []

    // methods of this object are available in evaluation of code in the settings file — "built-in rule types"
    ruleLib.user = {}

    ruleLib.user.prefix = function (prefixString) {
        const rule = String(prefixString)
        rulesArray.push(rule)
        return rule
    }

    // Matches patterns like: 'Send' <what>
    ruleLib.user.keyword = function (
        keyword,
        waitingActionName = "Waiting for response: $<what>"
    ) {
        // rule like /.*?(?:call|email)[\s\p{P}]*\s(?<what>.+)/iu
        if (keyword) {
            const regex = `.*?(?:${keyword})[\\s\\p{P}]*\\s(?<what>.+)`
            const rule = makeRegexRule(regex, waitingActionName)
            rulesArray.push(rule)
            return rule
        }
    }

    // Matches patterns like: 'Call' <who> 'about' <what>
    ruleLib.user.whoWhat = function (
        keyword,
        proposition,
        waitingActionName = "Waiting for response from $<who>: $<what>"
    ) {
        // rule like /.*?(?:call|email)\s+(?<who>.+)(?:[\s\p{P}]+(?:regarding|about)[\s\p{P}]+|—|[\s\p{P}]{2})(?<what>.+)/iu
        if (keyword && proposition) {
            const regex = `.*?(?:${keyword})\\s+(?<who>.+)(?:[\\s\\p{P}]+(?:${proposition})[\\s\\p{P}]+|—|[\\s\\p{P}]{2})(?<what>.+)`
            const rule = makeRegexRule(regex, waitingActionName)
            rulesArray.push(rule)
            return rule
        }
    }

    // Matches patterns like: 'Submit' <what> 'to' <who>
    ruleLib.user.whatWho = function (
        keyword,
        proposition,
        waitingActionName = "Waiting for response from $<who>: $<what>"
    ) {
        // rule like /.*?(?:submit)\s+(?<what>.+)(?:[\s\p{P}]+(?:to)[\s\p{P}]+|—|[\s\p{P}]{2})(?<who>.+)/iu
        // same regex as in requestWhoWhat() but with named capture groups inverted
        if (keyword && proposition) {
            const regex = `.*?(?:${keyword})\\s+(?<what>.+)(?:[\\s\\p{P}]+(?:${proposition})[\\s\\p{P}]+|—|[\\s\\p{P}]{2})(?<who>.+)`
            const rule = makeRegexRule(regex, waitingActionName)
            rulesArray.push(rule)
            return rule
        }
    }

    // Matches patterns of task name and tags like: Problem abc #call #person
    ruleLib.user.usingTags = function (
        keywordTagName,
        whoTagName,
        waitingAction = "Waiting for response: ${what}",
        waitingActionWho,
        whoStripEmoji = false
    ) {
        // the 2 following variables are available when 'waitingAction' and 'waitingActionWho' are evaluated:
        // 'who' is the name of the first tag which matches the 'whoTagName' filter,
        // 'what' is the name of the task being tested against the rule.
        if (keywordTagName && waitingAction) {
            const actionNameWho = waitingActionWho
                ? waitingActionWho
                : waitingAction
            function ruleFn(task) {
                if (filteredTags(task, keywordTagName)) {
                    const whoTag = firstTag(task, whoTagName)
                    const actionName = whoTag ? actionNameWho : waitingAction

                    // variables which can be used in the waitingAction arguments, eg. 'Waitng for ${what} from ${who}'
                    // eslint-disable-next-line no-unused-vars
                    const who = whoTag
                        ? whoStripEmoji
                            ? stripEmoji(whoTag.name)
                            : whoTag.name
                        : ""
                    // eslint-disable-next-line no-unused-vars
                    const what = task.name

                    return eval("`" + actionName + "`")
                }
            }
            const rule = [ruleFn, actionNameWho]
            rulesArray.push(rule)
            return rule
        }
    }

    ruleLib.user.customRegex = function (pattern, replace) {
        const rule = makeRegexRule(pattern, replace)
        rulesArray.push(rule)
        return rule
    }

    ruleLib.user.customFunction = function (fn, label) {
        const rule = label ? [fn, label] : fn
        rulesArray.push(rule)
        return rule
    }

    ruleLib.clearRules = () => (rulesArray.length = 0)
    ruleLib.getRules = () => rulesArray

    function makeRegexRule(pattern, replace) {
        return [new RegExp(pattern, "iu"), replace]
    }

    function filteredTags(task, tagFilter) {
        if (tagFilter && task) {
            const tagFilterNames = Array.isArray(tagFilter)
                ? tagFilter
                : [tagFilter]
            const tagFilterObj = tagFilterNames.map((name) =>
                flattenedTags.byName(String(name))
            )
            const tagFilterDesc = addDescendents(tagFilterObj)
            const tags = task.tags.filter((t) => tagFilterDesc.includes(t))
            if (tags.length) {
                return tags
            }
        }
    }

    function firstTag(task, tagFilter) {
        const tags = filteredTags(task, tagFilter)
        if (tags) {
            return tags[0]
        }
    }

    function addDescendents(arrayTags) {
        // Return a flat array of the tags and all their descendants, without duplicates
        try {
            const arrayWithDescs = arrayTags.flatMap((t) =>
                t ? [t, Array.from(t.flattenedTags)].flat() : []
            )
            return [...new Set(arrayWithDescs)]
            // eslint-disable-next-line no-empty
        } catch {}
    }

    function stripEmoji(string) {
        if (typeof string === "string") {
            return string.replaceAll(/\p{Emoji_Presentation}/gu, "").trim()
        } else {
            return string
        }
    }

    return ruleLib
})()
