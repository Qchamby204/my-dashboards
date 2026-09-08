# Original Neural Map navigation

Neural Map is a directory of existing tools and resources. These enhancements run only on `neural-map.html`, through the shared appearance loader. They use the original catalog and graph. No new record entry, storage schema, cloud sync, or setup is introduced.

Phones initially show List & search. Larger screens initially show Map. Either view is available on both, and changing views retains the current search and area filter for the page session. Search matches all entered words across titles, descriptions, categories and source notes. It does not search the contents of external files or chats.

List cards expose existing web links directly and can focus the corresponding node on the original map. Operations Cadence and Prospecting Command Center now also expose their existing dashboard routes. Desktop file locations are shown as selectable text with an explanation; they are not presented as working web links. Other source links and unavailable-resource notes remain as supplied, without claiming their availability has been checked.

One pointer controller handles pan, pinch and double tap. Pinch maintains the initial content anchor while accounting for the midpoint movement. Lifting one finger rebases the remaining pan. Canceled gestures are cleared, and a drag cannot trigger a node click. Zoom out supports the scale required to show the map on a narrow display. Fit and branch focus reserve space for navigation, and orientation changes refit the map.

Nodes have keyboard names and activation; resource details include an explicit Close control and Escape returns focus. Pressing `/` outside a form or dialog opens search. Panels and list scrolling use the shared device inset and visible viewport values. Light, dark and system appearance remain available.

Animated pulses stop while the map is hidden, the page is hidden, or reduced motion is requested. Camera transitions also respect reduced motion. Returning starts a single pulse loop.

Synthetic tests execute the original script with the enhancement and verify search, routing, gesture cancellation and anchoring, click suppression, zoom bounds, rotation, animation lifecycle and keyboard controls. Physical iPhone gestures, keyboard presentation, safe areas and installed home-screen behavior still require device testing.
