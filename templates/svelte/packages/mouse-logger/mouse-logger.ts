export function trackMouseEvents(enabled = false) {
    if (!enabled) return;
    
    document.addEventListener("mousemove", (event) => {
        console.log(`Mouse moved: X=${event.clientX}, Y=${event.clientY}`);
    });

    document.addEventListener("click", (event) => {
        console.log(`Mouse clicked: X=${event.clientX}, Y=${event.clientY}`);
    });
}
