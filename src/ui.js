"use strict"

if (typeof require !== "undefined") {
    // No imports.
}

/**
 * User Interface components
 * @module ui
 */
var ui = (function module() {
    /**
     * Manage a facets and their interaction with a listing of items.
     *
     * @param {HTMLElement} facets HTML Element containing the facets.
     * @param {HTMLElement} results HTML Element containing the listed items.
     * @param {{[name: string]: (selected: string[], item: Node) => boolean}}
     *        filters
     *        Filter functions that are called whenever there is a change to the
     *        selected facets. There should be one per facet.
     * @param {HTMLInputElement} [search] Search/Filter bar
     */
    function Facets(facets, results, filters, search) {
        const facetElements = facets.querySelectorAll(".facet")
        for (var i = 0; i < facetElements.length; i++) {
            addFacetEventListeners(facetElements[i])
        }

        var dirtyTimeoutID = 0

        if (search) {
            search.addEventListener("keyup", handleSearchKeyup)
        }

        /**
         * Updates the results based on a change in the search bar.
         *
         * @param {KeyboardEvent} keyup
         */
        function handleSearchKeyup(keyup) {
            if (keyup.isComposing || keyup.keyCode === 229) {
                // Ignore IME composition
                // @see https://developer.mozilla.org/en-US/docs/Web/API/Document/keyup_event
                return
            }

            // Delay results udpate by a half-second until user is done typing.
            clearTimeout(dirtyTimeoutID)
            dirtyTimeoutID = setTimeout(onFacetClick, 500)
            search.removeEventListener("keyup", handleSearchKeyup)
            search.dispatchEvent(new KeyboardEvent("keyup"))
            search.addEventListener("keyup", handleSearchKeyup)
        }

        /**
         * Increment the count of a facet option.
         *
         * If the specified option does not exists, it will be created.
         *
         * @param {string} facetID Unique facet name.
         * @param {string} optionID Unique identifier for the option.
         * @param {string} optionName Label for the option.
         */
        function increment(facetID, optionID, optionName) {
            const facet = facets.querySelector(".facet." + facetID + " ul")
            if (!facet) {
                return
            }

            var option

            const input = facet.querySelector('input[value="' + optionID + '"]')
            if (input) {
                option = input.parentElement
            }

            if (!option) {
                const template = facet.querySelector(".template")
                const data = {
                    box: {
                        value: optionID,
                        onclick: onFacetClick,
                    },
                    name: optionName,
                    count: 0,
                }

                option = Render(template, data)
            }

            const count = option.querySelector(".count")
            count.innerText = parseInt(count.innerText) + 1
        }

        function onFacetClick() {
            const lis = results.querySelectorAll("li")
            const items = []
            for (var i = 0; i < lis.length; i++) {
                items.push(lis[i])
            }

            const remainingSets = Object.keys(filters).map(function (filter) {
                const checked = facets.querySelectorAll(
                    ".facet." + filter + " input:checked"
                )

                const selected = []
                for (var i = 0; i < checked.length; i++) {
                    const input = checked[i]
                    const option = input.parentElement
                    const name = option.querySelector(".name")
                    selected.push(name.innerText.trim())
                }

                if (selected.length === 0) {
                    return items
                }

                const remaining = items.filter(function (item) {
                    return filters[filter](selected, item)
                })

                return remaining
            })

            for (var i = 0; i < items.length; i++) {
                const item = items[i]

                if (remainingSets.every(isItemInSubset)) {
                    var filteredBySearch = false

                    // Ensure that the search text is somewhere in the item.
                    if (search && search.value && search.value.trim()) {
                        const searchText = search.value.trim().toUpperCase()
                        const itemText = item.textContent || item.innerText
                        if (itemText.toUpperCase().indexOf(searchText) === -1) {
                            filteredBySearch = true
                        }
                    }

                    if (!filteredBySearch) {
                        // Item is in every set of remaining items.
                        item.className = item.className.replace("hidden", "")
                        item.className = item.className.trim()
                        continue
                    }
                }

                // Item was filtered out of all facets, hide it if necessary.
                if (item.className.indexOf("hidden") !== -1) {
                    continue
                }

                item.className = "hidden " + item.className
                item.className = item.className.trim()

                function isItemInSubset(subset) {
                    return subset.indexOf(item) !== -1
                }
            }
        }

        return {
            Increment: increment,
        }
    }

    /**
     * Clones template, fills it in with data, then adds it to the parent.
     *
     * Example:
     *     <section>
     *       <div class="template"><span class="name" /></div>
     *     </section>
     *
     *   Render(document.querySelector(".template"), {name: "Hi"}) =>
     *
     *     <section>
     *       <div class="template"><span class="name" /></div>
     *       <div><span class="name">Hi</span></div>
     *     </section>
     *
     * @param {Node} template
     * @param {Object.<string, any>} data
     */
    function Render(template, data) {
        const elem = Build(template, data)
        template.parentElement.appendChild(elem)
        return elem
    }

    /**
     * Clones template, fills it in with data, and returns it.
     *
     * Example:
     *     <section>
     *       <div class="template"><span class="name" /></div>
     *     </section>
     *
     *   Build(document.querySelector(".template"), {name: "Hi"}) =>
     *
     *     <div><span class="name">Hi</span></div>
     *
     * @param {Node} template
     * @param {Object.<string, any>} data
     */
    function Build(template, data) {
        const clone = template.cloneNode(true)
        clone.className = clone.className.replace("template", "")

        for (var key in data) {
            /** @type {Node} */
            const placeholder = clone.querySelector("." + key)
            if (!placeholder) {
                console.warn("render: missing placeholder: " + key)
                continue
            }

            processBinding(placeholder, data[key])
        }

        return clone
    }

    /**
     * Maintains a list's order and allows it to be reversed.
     *
     * @param {HTMLElement} ol Ordered list element.
     * @param {number} direction Initial order: 1 for normal, -1 for reverse.
     * @param {(li: HTMLLIElement) => string} [listItemKey]
     *        Callback function to get the sorting key for a list item.
     *        Defaults to a alphabetical ordering of the list item's innerText.
     */
    function SortedList(ol, direction, listItemKey) {
        if (!direction) {
            direction = 1
        }

        if (!listItemKey) {
            listItemKey = getText
        }

        // This observer is responsible for resorting the list whenever items
        // are added or remove.
        const observer = new MutationObserver(onMutate)
        observe()

        function getText(li) {
            const link = li.querySelector("a")
            if (!link) {
                return ""
            }
            return link.innerText
        }

        function observe() {
            observer.observe(ol, { childList: true })
        }

        function onMutate(/** @type {Array} */mutations) {
            var mutation = null

            for (var i = 0; i <= mutations.length; i++) {
                if (mutations[i].type === "childList") {
                    mutation = mutations[i]
                    break
                }
            }

            if (!mutation) {
                return
            }

            update()
        }

        function reverse() {
            direction *= -1
            update()
        }

        /** Sorts an ordered list's items. */
        function sort() {
            // Get immediate <li> children.
            const lis = []
            for (var i = 0; i < ol.children.length; i++) {
                lis.push(ol.children[i])
            }

            lis.sort(function (a, b) {
                const name1 = listItemKey(a)
                const name2 = listItemKey(b)

                if (!name1) return -1
                if (!name2) return 1
                if (name1 < name2) return -1 * direction
                if (name1 > name2) return 1 * direction
                return 0
            })

            while (ol.firstChild) {
                ol.removeChild(ol.firstChild)
            }

            lis.forEach(function (li) {
                ol.appendChild(li)
            })
        }

        var dirty = 0

        function update() {
            // Limit resorting to once in 100ms.
            if (dirty) {
                return
            }

            dirty = setTimeout(function () {
                // Stop observing changes until after sorting is complete,
                // otherwise each change during sorting will trigger onMutate
                // causing a never-ending cycle.
                observer.disconnect()
                sort()
                observe()
                dirty = 0
            }, 100)
        }

        return {
            Reverse: reverse,
            Update: update,
        }
    }

    /**
     * Add event listeners for facet controls: show, limit, reset.
     * @param {HTMLElement} facet
     */
    function addFacetEventListeners(facet) {
        const show = facet.querySelector(".show")
        const limit = facet.querySelector(".limit")
        const reset = facet.querySelector(".reset")

        show.addEventListener("click", showFacet)
        limit.addEventListener("click", hideFacet)
        reset.addEventListener("click", resetFacet)

        function showFacet(clickEvent) {
            clickEvent.preventDefault()
            facet.className = facet.className.replace("limit", "").trim()
        }

        function hideFacet(clickEvent) {
            clickEvent.preventDefault()
            facet.className = (facet.className + " limit").trim()
        }

        function resetFacet(clickEvent) {
            clickEvent.preventDefault()
            const checkboxes = facet.querySelectorAll("input")
            for (var j = 0; j < checkboxes.length; j++) {
                if (checkboxes[j].checked) {
                    checkboxes[j].click()
                }
            }
        }
    }

    /**
     * Processes a binding for `Build`.
     * @param {Node} placeholder
     * @param {any} binding
     * @param {bool} allowArray Whether or not to allow binding to be an array
     */
    function processBinding(placeholder, binding, allowArray = true) {
        switch (typeof binding) {
            case "function":
                binding(setText(placeholder))
                break

            case "object":
                if (allowArray && Array.isArray(binding)) {
                    if (binding.length === 0) {
                        placeholder.parentNode.removeChild(placeholder)
                        break
                    }
                    for (var i = binding.length-1; i > 0; i--) {
                        const clone = placeholder.cloneNode(true)
                        processBinding(clone, binding[i], !allowArray)
                        placeholder.parentNode.insertBefore(clone, placeholder)
                    }
                    processBinding(placeholder, binding[0], !allowArray)
                    break
                }

                for (var name in binding) {
                    const isEventListener = name.slice(0, 2) === "on"
                    if (isEventListener) {
                        const event = name.slice(2)
                        placeholder.addEventListener(event, binding[name])
                        continue
                    }

                    const isFunction = binding[name] instanceof Function
                    if (isFunction) {
                        const attrib = name
                        binding[attrib](done)
                        function done(val) {
                            placeholder[attrib] = val
                        }
                        continue
                    }

                    placeholder[name] = binding[name]
                }
                break

            case "string":
            default:
                placeholder.innerHTML = binding
                break
        }

        function setText(element) {
            return function callback(text) {
                element.innerHTML = text
            }
        }
    }

    // Module Exports
    return {
        Facets: Facets,
        Render: Render,
        SortedList: SortedList,
        Build: Build,
    }
})()

if (typeof module !== "undefined") {
    module.exports = ui
}
