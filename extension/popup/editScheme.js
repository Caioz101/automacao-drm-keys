document.getElementById("editSchemeButton").addEventListener("click", () => {
    document.getElementById("editSchemeContainer").style.display = "grid"
    document.getElementById('home').style.display='none';
    document.getElementById('toggleHistory').style.display='none';
})

document.getElementById("editSchemeOK").addEventListener("click", () => {
    document.getElementById("editSchemeContainer").style.display = "none"
    document.getElementById('home').style.display='grid';
    document.getElementById('toggleHistory').style.display='grid';
})

document.getElementById("schemeSelect").addEventListener("input", async () => {
    document.getElementById("schemeCode").value = await fetch(`/python/schemes/${document.getElementById("schemeSelect").value}.py`).then(res=>res.text())
})
