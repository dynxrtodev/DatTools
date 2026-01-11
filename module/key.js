        const STRING = -1;
        const STRING_XOR = -2;
        const XOR_KEY = "PBG892FXX982ABC*";

        // Field template structure
        function field(size, version = 0) {
            return { size, version };
        }

        function getGenericTemplate() {
            return {
                id: field(4),
                properties: field(2),
                type: field(1),
                material: field(1),
                name: field(STRING_XOR),
                rttexName: field(STRING),
                rttexHash: field(4),
                visualType: field(1),
                cookTime: field(4),
                texX: field(1),
                texY: field(1),
                storageType: field(1),
                layer: field(1),
                collisionType: field(1),
                hardness: field(1),
                regenTime: field(4),
                clothingType: field(1),
                rarity: field(2),
                maxHold: field(1),
                altRttexPath: field(STRING),
                altRttexHash: field(4),
                animMs: field(4),
                petName: field(STRING, 4),
                petPrefix: field(STRING, 4),
                petSuffix: field(STRING, 4),
                petAbility: field(STRING, 5),
                seedBase: field(1),
                seedOver: field(1),
                treeBase: field(1),
                treeOver: field(1),
                bgCol: field(4),
                fgCol: field(4),
                seed1: field(2),
                seed2: field(2),
                bloomTime: field(4),
                animType: field(4, 7),
                animString: field(STRING, 7),
                animTex: field(STRING, 8),
                animString2: field(STRING, 8),
                dlayer1: field(4, 8),
                dlayer2: field(4, 8),
                properties2: field(2, 9),
                _unk1: field(62, 9),
                tileRange: field(4, 10),
                pileRange: field(4, 10),
                customPunch: field(STRING, 11),
                _unk2: field(13, 12),
                clockDiv: field(4, 13),
                parentId: field(4, 14),
                _unk3: field(25, 15),
                altSitPath: field(STRING, 15),
                customRender: field(STRING, 16),
                _unk4: field(4, 17),
                customRenderHash: field(4, 18),
                _unk5: field(9, 19),
                itemState: field(2, 21),
                description: field(STRING, 22),
                r_seed1: field(2, 23),
                r_seed2: field(2, 23),
                _unk6: field(1, 24)
            };
        }

        // Parse functions
        function parseNumber(buffer, offset, size) {
            let value = 0;
            for (let i = 0; i < size; i++) {
                value += buffer[offset + i] << (i * 8);
            }
            return [value, offset + size];
        }

        function parseString(buffer, offset) {
            const [length, newOffset] = parseNumber(buffer, offset, 2);
            const str = String.fromCharCode.apply(null, buffer.slice(newOffset, newOffset + length));
            return [str, newOffset + length];
        }

        function decryptItemName(name, id) {
            return Array.from(name).map((char, i) => 
                String.fromCharCode(char.charCodeAt(0) ^ XOR_KEY.charCodeAt((i + id) % XOR_KEY.length))
            ).join('');
        }

        // Main parsing function
        function parseItemsDat(buffer) {
            let offset = 0;
            const [version] = parseNumber(buffer, offset, 2);
            offset += 2;
            const [itemCount] = parseNumber(buffer, offset, 4);
            offset += 4;

            const template = getGenericTemplate();
            const root = { version, itemCount, items: [] };

            for (let i = 0; i < itemCount; i++) {
                const item = {};
                for (const [key, value] of Object.entries(template)) {
                    if (value.version > version) continue;
                    
                    let fieldValue;
                    if (value.size === STRING_XOR && version >= 3) {
                        [fieldValue, offset] = parseString(buffer, offset);
                        fieldValue = decryptItemName(fieldValue, item.id);
                    } else if (value.size === STRING) {
                        [fieldValue, offset] = parseString(buffer, offset);
                    } else {
                        [fieldValue, offset] = parseNumber(buffer, offset, value.size);
                    }

                    if (!key.startsWith('_')) {
                        item[key] = fieldValue;
                    }
                }
                root.items.push(item);
            }
            return root;
        }

        // Encoding functions
        function writeNumber(buffer, value, size) {
            for (let i = 0; i < size; i++) {
                buffer[i] = (value >> (i * 8)) & 0xFF;
            }
            return size;
        }

        function writeString(buffer, str, offset = 0) {
            const strBuf = new TextEncoder().encode(str);
            const len = writeNumber(buffer.subarray(offset), strBuf.length, 2);
            buffer.set(strBuf, offset + len);
            return len + strBuf.length;
        }

        function encryptItemName(name, id) {
            return decryptItemName(name, id);
        }

        function encodeItemsDat(jsonData) {
            // Estimate buffer size (10MB max)
            const bufferSize = 10 * 1024 * 1024;
            const buffer = new Uint8Array(bufferSize);
            let offset = 0;

            offset += writeNumber(buffer.subarray(offset), jsonData.version, 2);
            offset += writeNumber(buffer.subarray(offset), jsonData.items.length, 4);

            const template = getGenericTemplate();
            for (let i = 0; i < jsonData.items.length; i++) {
                const item = jsonData.items[i];
                for (const [key, field] of Object.entries(template)) {
                    if (field.version > jsonData.version) continue;

                    let value = item[key] || 0;
                    if (jsonData.version >= 23 && key === 'recipe' && item.recipe == null) {
                        const p1 = item.recipePart1 || 0;
                        const p2 = item.recipePart2 || 0;
                        value = (p1 & 0xFFFF) | ((p2 & 0xFFFF) << 16);
                    }
                    if (field.size === STRING_XOR) {
                        if (jsonData.version >= 3) {
                            value = encryptItemName(value || '', item.id);
                            offset += writeString(buffer, value, offset);
                        }
                    } else if (field.size === STRING) {
                        offset += writeString(buffer, value || '', offset);
                    } else {
                        offset += writeNumber(buffer.subarray(offset), value, field.size);
                    }
                }
            }
            return buffer.slice(0, offset);
        }

        // Custom format functions
 function encodeCustomFormat(data) {
  const ORDER = [
  "id",
  "properties",
  "type",
  "material",
  "name",
  "rttexName",
  "rttexHash",
  "visualType",
  "cookTime",
  "texX",
  "texY",
  "storageType",
  "layer",
  "collisionType",
  "hardness",
  "regenTime",
  "clothingType",
  "rarity",
  "maxHold",
  "altRttexPath",
  "altRttexHash",
  "animMs",
  "petName",
  "petPrefix",
  "petSuffix",
  "petAbility",
  "seedBase",
  "seedOver",
  "treeBase",
  "treeOver",
  "bgCol",
  "fgCol",
  "seed1",
  "seed2",
  "bloomTime",
  "animType",
  "animString",
  "animTex",
  "animString2",
  "dlayer1",
  "dlayer2",
  "properties2",
  "tileRange",
  "pileRange",
  "customPunch",
  "clockDiv",
  "parentId",
  "altSitPath",
  "customRender",
  "customRenderHash",
  "itemState",
  "description",
  "r_seed1",
  "r_seed2"
  ];

  let output = "";
  output += "Thx for @Tenet\n";
  output += "Impruv by @Tyn\n";
  output += "Format : add_item\\id\\properties\\type\\material\\name\\rttexName\\rttexHash\\visualType\\cookTime\\texX\\texY\\storageType\\layer\\collisionType\\hardness\\regenTime\\clothingType\\rarity\\maxHold\\altRttexPath\\altRttexHash\\animMs\\petName\\petPrefix\\petSuffix\\petAbility\\seedBase\\seedOver\\treeBase\\treeOver\\bgCol\\fgCol\\seed1\\seed2\\bloomTime\\animType\\animString\\animTex\\animString2\\dlayer1\\dlayer2\\properties2\\tileRange\\pileRange\\customPunch\\clockDiv\\parentId\\altSitPath\\customRender\\customRenderHash\\itemState\\description\\r_seed1\\r_seed2\n";
  output += `Dat Version :${data.version}\n`;
  output += `Item Count :${data.itemCount}\n`;
  output += `---\n`;

  for (const item of data.items) {
    const vals = ORDER.map(key => {
      let val = item[key] ?? "";
      return String(val)
        .replace(/\\/g, "\\\\")
        .replace(/\n/g, "\\n");
    });

    output += "add_item\\" + vals.join("\\") + "\n";
  }

  return output;
}

   function decodeCustomFormat(text) {
  const ORDER = [
  "id",
  "properties",
  "type",
  "material",
  "name",
  "rttexName",
  "rttexHash",
  "visualType",
  "cookTime",
  "texX",
  "texY",
  "storageType",
  "layer",
  "collisionType",
  "hardness",
  "regenTime",
  "clothingType",
  "rarity",
  "maxHold",
  "altRttexPath",
  "altRttexHash",
  "animMs",
  "petName",
  "petPrefix",
  "petSuffix",
  "petAbility",
  "seedBase",
  "seedOver",
  "treeBase",
  "treeOver",
  "bgCol",
  "fgCol",
  "seed1",
  "seed2",
  "bloomTime",
  "animType",
  "animString",
  "animTex",
  "animString2",
  "dlayer1",
  "dlayer2",
  "properties2",
  "tileRange",
  "pileRange",
  "customPunch",
  "clockDiv",
  "parentId",
  "altSitPath",
  "customRender",
  "customRenderHash",
  "itemState",
  "description",
  "r_seed1",
  "r_seed2"
  ];

  const lines = text.split('\n');
  let version = 0;
  let itemCount = 0;
  const items = [];
  let inItems = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith('VERSION=')) {
      version = parseInt(line.split('=')[1]);
      continue;
    }
    if (line.startsWith('ITEMCOUNT=')) {
      itemCount = parseInt(line.split('=')[1]);
      continue;
    }
    if (line === '---') {
      inItems = true;
      continue;
    }
    if (!inItems) continue;

    // must start with add_item\
    if (!line.startsWith('add_item\\')) continue;

    const parts = line.replace(/^add_item\\/, '').split('\\');
    const item = {};

    ORDER.forEach((key, idx) => {
      let value = parts[idx] ?? '';

      value = value
        .replace(/\\n/g, '\n')
        .replace(/\\\\/g, '\\');

      if (value === '') {
        item[key] = '';
      } else if (!isNaN(value)) {
        item[key] = Number(value);
      } else {
        item[key] = value;
      }
    });

    items.push(item);
  }

  return { version, itemCount, items };
}

 function showLoading() {
  document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loading').classList.add('hidden');
}

        // UI Functions
        document.addEventListener('DOMContentLoaded', function() {
            const fileInput = document.getElementById('fileInput');
            const decodeBtn = document.getElementById('decodeBtn');
            const encodeBtn = document.getElementById('encodeBtn');
            const clearBtn = document.getElementById('clearBtn');
            const status = document.getElementById('status');
            const downloadLinks = document.getElementById('downloadLinks');
            const preview = document.getElementById('preview');

            let currentFile = null;
            let currentFileType = null;


            // File input handler
            fileInput.addEventListener('change', function(e) {
                if (e.target.files.length === 0) return;
                
                const file = e.target.files[0];
                const reader = new FileReader();
                
                reader.onload = function(event) {
                    const arrayBuffer = event.target.result;
                    
                    // Determine file type
                    if (file.name.endsWith('.dat')) {
                        currentFileType = 'dat';
                        currentFile = new Uint8Array(arrayBuffer);
                        preview.textContent = `Loaded items.dat file (${currentFile.length} bytes)\nFirst 100 bytes preview:\n${Array.from(currentFile.slice(0, 100)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`;
                    } else if (file.name.endsWith('.json')) {
                        currentFileType = 'json';
                        const text = new TextDecoder().decode(arrayBuffer);
                        currentFile = text;
                        preview.textContent = `Loaded JSON file (${text.length} characters)\nPreview:\n${text.substring(0, 500)}${text.length > 500 ? '...' : ''}`;
                    } else if (file.name.endsWith('.txt')) {
                    currentFileType = 'txt';
                    currentFile = event.target.result;
                    preview.textContent = `Loaded TXT file (${currentFile.length} characters)\nPreview:\n${currentFile.substring(0, 500)}${currentFile.length > 500 ? '...' : ''}`;
                            }
                    
                    updateButtonStates();
                    showStatus('File loaded successfully: ' + file.name, 'success');
                };
                
                if (file.name.endsWith('.dat')) {
                    reader.readAsArrayBuffer(file);
                } else {
                    reader.readAsText(file);
                }
            });

            // Decode button handler
            decodeBtn.addEventListener('click', function () {
    if (!currentFile || currentFileType !== 'dat') {
        showStatus('Please select a valid items.dat file', 'error');
        return;
    }

    showLoading();
    setTimeout(() => {
        try {
            const itemsData = parseItemsDat(currentFile);
            const outputBaseName = outputName.value || 'items';

            const jsonOutput = JSON.stringify(itemsData, null, 2);
            const customOutput = encodeCustomFormat(itemsData);

            downloadLinks.innerHTML = '<h3>Download processed files:</h3>';
            downloadLinks.style.display = 'block';

            // JSON download link
            const jsonBlob = new Blob([jsonOutput], { type: 'application/json' });
            const jsonUrl = URL.createObjectURL(jsonBlob);
            const jsonLink = document.createElement('a');
            jsonLink.href = jsonUrl;
            jsonLink.download = outputBaseName + '.json';
            jsonLink.className = 'download-link';
            jsonLink.textContent = 'Download JSON';
            downloadLinks.appendChild(jsonLink);

            // TXT download link
            const txtBlob = new Blob([customOutput], { type: 'text/plain' });
            const txtUrl = URL.createObjectURL(txtBlob);
            const txtLink = document.createElement('a');
            txtLink.href = txtUrl;
            txtLink.download = outputBaseName + '.txt';
            txtLink.className = 'download-link';
            txtLink.textContent = 'Download TXT';
            downloadLinks.appendChild(txtLink);

            preview.textContent =
                `Decoded ${itemsData.itemCount} items (version ${itemsData.version})\n\nFirst item preview:\n` +
                JSON.stringify(itemsData.items[0], null, 2);

            showStatus(`Successfully decoded ${itemsData.itemCount} items`, 'success');
        } catch (error) {
            console.error(error);
            showStatus('Error decoding file: ' + error.message, 'error');
        }
        hideLoading();
    }, 50);
});

            // Encode button handler
encodeBtn.addEventListener('click', function () {
    if (!currentFile || (currentFileType !== 'json' && currentFileType !== 'txt')) {
        showStatus('Please select a valid JSON or TXT file', 'error');
        return;
    }

    showLoading();
    setTimeout(() => {
        try {
            let jsonData;

            if (currentFileType === 'txt') {
                jsonData = decodeCustomFormat(currentFile);
            } else {
                jsonData = JSON.parse(currentFile);
            }

            const encodedData = encodeItemsDat(jsonData);
            const outputBaseName = outputName.value || 'items';

            downloadLinks.innerHTML = '<h3>Download processed files:</h3>';
            downloadLinks.style.display = 'block';

            const datBlob = new Blob([encodedData], { type: 'application/octet-stream' });
            const datUrl = URL.createObjectURL(datBlob);
            const datLink = document.createElement('a');
            datLink.href = datUrl;
            datLink.download = outputBaseName + '.dat';
            datLink.className = 'download-link';
            datLink.textContent = 'Download items.dat';
            downloadLinks.appendChild(datLink);

            preview.textContent =
                `Encoded ${jsonData.items.length} items to items.dat format\n` +
                `File size: ${encodedData.length} bytes\n` +
                `Version: ${jsonData.version}`;

            showStatus(`Successfully encoded ${jsonData.items.length} items`, 'success');
        } catch (error) {
            console.error(error);
            showStatus('Error encoding file: ' + error.message, 'error');
        }
        hideLoading();
    }, 50);
});

            // Clear button handler
            clearBtn.addEventListener('click', function() {
                fileInput.value = '';
                currentFile = null;
                currentFileType = null;
                preview.textContent = 'No file loaded yet. Select a file to begin.';
                downloadLinks.style.display = 'none';
                downloadLinks.innerHTML = '';
                updateButtonStates();
                showStatus('Cleared all data', 'info');
            });

            // Update button states based on file type
            function updateButtonStates() {
                if (currentFileType === 'dat') {
                    decodeBtn.disabled = false;
                    encodeBtn.disabled = true;
                } else if (currentFileType === 'json' || currentFileType === 'txt') {
                    decodeBtn.disabled = true;
                    encodeBtn.disabled = false;
                } else {
                    decodeBtn.disabled = true;
                    encodeBtn.disabled = true;
                }
            }

            // Show status message
            function showStatus(message, type) {
                status.textContent = message;
                status.className = 'status ' + type;
            }

            // Initialize
            updateButtonStates();
        });
