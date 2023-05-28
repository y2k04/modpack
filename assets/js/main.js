var ModrinthAPI = {},
    CurseForgeAPI = {},
    ModsData = {},
    MCReleases = [],
    MCSnapshots = [],
    SelectedMCVersion = "",
    MCVersionSelector = document.getElementById("mc_ver"),
    MCVerTypeSelector = document.getElementById("mc_ver_type"),
    webConsole = document.getElementById("webConsole"),
    compatibleModsList = document.getElementById("compatible"),
    incompatibleModsList = document.getElementById("incompatible"),
    downloadButton = document.getElementById("download"),
    compatibleMods = [],
    zip = new JSZip();

ModrinthAPI.Header = { method: "GET" };
CurseForgeAPI.Header = { method: "GET", headers: { "x-api-key": "$2a$10$X7aJaQsgK0c4LKrSMhWDEuIGIsOswL.lko63jo4eLdvd1DtNol9F2" } };

ModrinthAPI.GetModById = async id => await fetch(`https://api.modrinth.com/v2/project/${id}`, ModrinthAPI.Header).then(res => res.json());
ModrinthAPI.GetModVersions = async id => await fetch(`https://api.modrinth.com/v2/project/${id}/version?loaders=["fabric"]`, ModrinthAPI.Header).then(res => res.json());
ModrinthAPI.GetModDependencies = async id => await fetch(`https://api.modrinth.com/v2/project/${id}/dependencies`, ModrinthAPI.Header).then(res => res.json());
CurseForgeAPI.GetModById = async id => await fetch(`https://api.curseforge.com/v1/mods/${id}`, CurseForgeAPI.Header).then(res => res.json());
const GetModsJSON = async () => await fetch("assets/mods.json", ModrinthAPI.Header).then(res => res.json());
const GetMCVersions = async () => await fetch("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json", ModrinthAPI.Header).then(res => res.json());

async function SortMCVersions() {
    var versions = (await GetMCVersions()).versions;
    for (var i = 0; i < versions.length; i++) {
        if (versions[i].type == "snapshot")
            MCSnapshots.push(versions[i].id);
        else
            MCReleases.push(versions[i].id);
    }
    PopulateMCVersionSelector("release");
    MCVersionSelector.removeAttribute("disabled");
}

function PopulateMCVersionSelector(type) {
    MCVersionSelector.replaceChildren();
    if (type == "release") {
        for (var i = 0; i < MCReleases.length; i++) {
            var option = document.createElement("option");
            option.value = option.innerText = option.id = MCReleases[i];
            MCVersionSelector.appendChild(option);
        }
    } else if (type == "snapshot") {
        for (var i = 0; i < MCSnapshots.length; i++) {
            var option = document.createElement("option");
            option.value = option.innerText = option.id = MCSnapshots[i];
            MCVersionSelector.appendChild(option);
        }
    }
    MCVersionSelector.value = "";
};

async function ScanMods() {
    compatibleModsList.replaceChildren();
    incompatibleModsList.replaceChildren();
    webConsole.value = `Scanning mods compatibility with Minecraft ${SelectedMCVersion}...\n`
    for (var i = 0; i < ModsData.length; i++) {
        webConsole.value += `\nChecking ${ModsData[i].name}... `;
        var mod = document.createElement("tr");
        mod.innerHTML = `<td>${ModsData[i].name}</td>`;
        if (ModsData[i].service == "modrinth") {
            var modVers = await ModrinthAPI.GetModVersions(ModsData[i].id);
            var modVer = modVers.find(d => d.game_versions.includes(SelectedMCVersion));
            try {
                if (modVer != undefined) {
                    webConsole.value += `yes (${modVer.version_number})`;
                    compatibleModsList.appendChild(mod);
                    compatibleMods.push({
                        "name": ModsData[i].name,
                        "url": modVer.files[0].url
                    });
                } else {
                    var findCompat = ModsData[i].reported_compat.find(d => d.mc_vers.find(e => e == SelectedMCVersion));
                    if (findCompat.mc_vers.find(d => d == SelectedMCVersion) != undefined) {
                        webConsole.value += `yes (${findCompat.version})`;
                        compatibleModsList.appendChild(mod);
                        compatibleMods.push({
                            "name": ModsData[i].name,
                            "url": modVers.find(d => d.version_number.includes(findCompat.version)).files[0].url
                        });
                    }
                }
            } catch {
                webConsole.value += `no`;
                incompatibleModsList.appendChild(mod);
            }
        } else if (ModsData[i].service == "curseforge") {
            var modData = (await CurseForgeAPI.GetModById(ModsData[i].id)).data;
            var modVer = modData.latestFilesIndexes.find(e => e.gameVersion == SelectedMCVersion && (e.modLoader == 4 || e.modLoader == 5));
            try {
                if (modVer != undefined) {
                    webConsole.value += `yes (${modVer.filename})`;
                    compatibleModsList.appendChild(mod);
                    compatibleMods.push({
                        "name": ModsData[i].name,
                        "url": `https://api.allorigins.win/raw?url=https://mediafilez.forgecdn.net/files/${modVer.fileId.toString().substring(0,4)}/${modVer.fileId.toString().substring(4,7)}/${modVer.filename}`
                    });
                } else {
                    var findCompat = ModsData[i].reported_compat.find(d => d.mc_vers.find(e => e == SelectedMCVersion));
                    if (findCompat.mc_vers.find(d => d == SelectedMCVersion) != undefined) {
                        var filename = modData.latestFilesIndexes.find(e => e.fileId == findCompat.fileId).filename;
                        webConsole.value += `yes (${findCompat.version})`;
                        compatibleModsList.appendChild(mod);
                        compatibleMods.push({
                            "name": ModsData[i].name,
                            "url": `https://api.allorigins.win/raw?url=https://mediafilez.forgecdn.net/files/${findCompat.fileId.toString().substring(0,4)}/${findCompat.fileId.toString().substring(4,7)}/${filename}`
                        });
                    }
                }
            } catch {
                webConsole.value += `no`;
                incompatibleModsList.appendChild(mod);
            }
        }
        webConsole.scrollTop = webConsole.scrollHeight;
    }
    webConsole.value += "\n\nScan complete.";
    webConsole.scrollTop = webConsole.scrollHeight;
}

async function zipMods() {
    webConsole.value += `\n\nZipping ${compatibleMods.length + 1} mods...\n`;
    webConsole.scrollTop = webConsole.scrollHeight;

    for (var i = 0; i < compatibleMods.length; i++) {
        webConsole.value += `\nAdding ${compatibleMods[i].name}...`;
        webConsole.scrollTop = webConsole.scrollHeight;

        await zip.file(decodeURIComponent(compatibleMods[i].url).substring(compatibleMods[i].url.lastIndexOf("/") + 1), await JSZipUtils.getBinaryContent(compatibleMods[i].url), async (e, d) => resolve(d));
    }

    webConsole.value += "\nDownloading mods.zip now...";
    webConsole.scrollTop = webConsole.scrollHeight;

    await zip.generateAsync({type: "blob"}).then(f => saveAs(f, "mods.zip"));

    webConsole.value += "\n\nFinished.";
    webConsole.scrollTop = webConsole.scrollHeight;

    zip = new JSZip();
}

(async () => {
    webConsole.value = "";
    MCVerTypeSelector.value = "release";
    ModsData = await GetModsJSON();
    await SortMCVersions();
    MCVersionSelector.value = "";
    MCVerTypeSelector.addEventListener("input", () => PopulateMCVersionSelector(MCVerTypeSelector.value));
    MCVersionSelector.addEventListener("input", async () => {
        MCVerTypeSelector.setAttribute("disabled", "");
        MCVersionSelector.setAttribute("disabled", "");
        downloadButton.setAttribute("disabled", "");
        SelectedMCVersion = MCVersionSelector.value;
        await ScanMods();
        MCVerTypeSelector.removeAttribute("disabled");
        MCVersionSelector.removeAttribute("disabled");
        downloadButton.removeAttribute("disabled");
    });
    downloadButton.addEventListener("click", async () => await zipMods());
})();
