function createStageList(stageList) {
  const groupMap = {};
  for (const key in stageList) {
    const stage = stageList[key];
    let groupName = stage.name;
    const match = groupName.match(/^(ステージ\s*\d+)/);
    if (match) {
      groupName = match[1];
    }
    if (!groupMap[groupName]) {
      groupMap[groupName] = [];
    }
    groupMap[groupName].push(stage);
  }

  const stageListElem = document.getElementById('stage_list');
  stageListElem.innerHTML = '';

  Object.keys(groupMap)
    .sort((a, b) => {
      const aMatch = a.match(/(\d+)/);
      const bMatch = b.match(/(\d+)/);
      if (aMatch && bMatch) {
        return parseInt(aMatch[1], 10) - parseInt(bMatch[1], 10);
      }
      return a.localeCompare(b, 'ja', {numeric: true});
    })
    .forEach(groupName => {
      const groupDiv = document.createElement('div');
      groupDiv.classList.add('stage_group');

      const groupTitle = document.createElement('div');
      groupTitle.classList.add('stage_group_title');
      groupTitle.textContent = groupName;
      groupDiv.appendChild(groupTitle);

      const rowDiv = document.createElement('div');
      rowDiv.classList.add('stage_row');

      groupMap[groupName].sort((a, b) => {
        const aMatch = a.name.match(/-(\d+)$/);
        const bMatch = b.name.match(/-(\d+)$/);
        if (aMatch && bMatch) {
          return parseInt(aMatch[1], 10) - parseInt(bMatch[1], 10);
        }
        return a.name.localeCompare(b.name, 'ja', {numeric: true});
      }).forEach(stage => {
        rowDiv.appendChild(createStageCard(stage, stageList));
      });

      groupDiv.appendChild(rowDiv);
      stageListElem.appendChild(groupDiv);
    });
}

let stageDetailElements = null;

function createStageCard(stage, stageList) {
  const oneStage = document.createElement('div');
  oneStage.classList.add('one_stage');
  oneStage.id = 'link_id_' + stage.stage_id;

  const stageDiv = document.createElement('div');
  stageDiv.classList.add('stage_div');
  stageDiv.dataset.stageId = stage.stage_id;

  if (stage.level) {
    const stageLevel = document.createElement('div');
    stageLevel.classList.add('stage_level');
    stageLevel.textContent = 'Level ' + stage.level;
    stageDiv.appendChild(stageLevel);
  }

  const stageClear = document.createElement('div');
  stageClear.classList.add('stage_status');
  if (localStorage[stage.stage_id]) {
    stageClear.classList.add('stage_clear');
  }
  stageDiv.appendChild(stageClear);

  const stageName = document.createElement('div');
  stageName.classList.add('stage_name');
  stageName.textContent = stage.name;
  stageDiv.appendChild(stageName);

  const stageInfo = document.createElement('div');
  stageInfo.classList.add('stage_info');
  stageInfo.textContent = stage.info || '';
  stageDiv.appendChild(stageInfo);

  stageDiv.addEventListener('click', function (e) {
    document.querySelectorAll('.stage_div').forEach(div => {
      div.classList.remove('stage_select_on');
    });
    this.classList.add('stage_select_on');
    stage_info_create(this.dataset.stageId, stageList);
    e.stopPropagation();
  });

  oneStage.appendChild(stageDiv);
  return oneStage;
}

function createStageInfoData(id, labelKey, dataId, tailLabelKey) {
  const dataRow = document.createElement('div');
  dataRow.id = id;
  dataRow.classList.add('stage_info_data');

  dataRow.appendChild(document.createTextNode(lng_list[labelKey]));

  let dataValue = null;
  if (dataId) {
    dataValue = document.createElement('div');
    dataValue.id = dataId;
    dataValue.classList.add('stage_info_data_inline');
    dataRow.appendChild(dataValue);
  }

  if (tailLabelKey) {
    dataRow.appendChild(document.createTextNode(lng_list[tailLabelKey]));
  }

  return {
    row: dataRow,
    value: dataValue,
  };
}

function buildStageDetailSkeleton(stageDetail) {
  const stageInfoName = document.createElement('div');
  stageInfoName.id = 'stage_info_name';

  const stageJoinDiv = document.createElement('div');
  stageJoinDiv.id = 'stage_join_div';

  const stageInfoCondition = document.createElement('div');
  stageInfoCondition.id = 'stage_info_condition';

  const conditionLabel = document.createElement('span');
  conditionLabel.textContent = lng_list['CLEAR_CONDITION'];
  stageInfoCondition.appendChild(conditionLabel);

  const hartInfo = createStageInfoData('stage_info_hart', 'INFO_HART_B', 'stage_info_hart_data', 'INFO_HART_A');
  const putInfo = createStageInfoData('stage_info_put', 'INFO_PUT');
  const blockInfo = createStageInfoData('stage_info_block', 'INFO_BLOCK_B', 'stage_info_block_data', 'INFO_BLOCK_A');
  const turnInfo = createStageInfoData('stage_info_turn', 'INFO_TURN_B', 'stage_info_turn_data', 'INFO_TURN_A');

  stageInfoCondition.append(hartInfo.row, putInfo.row, blockInfo.row, turnInfo.row);

  const stageMap = document.createElement('div');
  stageMap.id = 'stage_map';

  const fragment = document.createDocumentFragment();
  fragment.append(stageInfoName, stageJoinDiv, stageInfoCondition, stageMap);
  stageDetail.appendChild(fragment);

  return {
    stageInfoName,
    stageJoinDiv,
    hartInfo,
    putInfo,
    blockInfo,
    turnInfo,
    stageMap,
  };
}

function getStageDetailElements(stageDetail) {
  if (!stageDetailElements) {
    stageDetailElements = buildStageDetailSkeleton(stageDetail);
  }
  return stageDetailElements;
}

function stage_info_create(id, stageList) {
  const stage = stageList[id];
  if (!stage) {
    return; // 無効なステージ ID の場合は処理しない
  }

  const stageDetail = document.getElementById('stage_detail');
  if (!stageDetail) {
    return; // DOM 構造が存在しない場合は何もしない
  }

  const elements = getStageDetailElements(stageDetail);
  const {
    stageInfoName,
    stageJoinDiv,
    hartInfo,
    putInfo,
    blockInfo,
    turnInfo,
    stageMap,
  } = elements;

  const existingTable = document.getElementById('map_table');
  if (existingTable) {
    existingTable.remove();
  }

  const table = document.createElement('table');
  table.id = 'map_table';
  const data = Array.isArray(stage.map_data) ? stage.map_data : [];
  const cols = data.length ? data[0].length : 0;

  for (let i = 0; i < data.length; i++) {
    const row = table.insertRow(-1);
    for (let j = 0; j < cols; j++) {
      const cell = row.insertCell(-1);
      const value = data[i][j];

      if (value === 0) {
        cell.classList.add('field_img');
      } else if (value === 1) {
        cell.classList.add('wall_img');
      } else if (value === 2) {
        cell.classList.add('hart_img');
      } else if (value === 3) {
        cell.classList.add('cool_img');
      } else if (value === 4) {
        cell.classList.add('hot_img');
      } else if (value === 34) {
        cell.classList.add('ch_img');
      } else if (value === 43) {
        cell.classList.add('hc_img');
      }
    }
  }

  stageInfoName.textContent = stage.name;

  const hartRow = hartInfo.row;
  const putRow = putInfo.row;
  if (stage.mode === 'gethart') {
    if (hartInfo.value) {
      hartInfo.value.textContent = stage.get_hart_value;
    }
    hartRow.classList.remove('display_off');
    putRow.classList.add('display_off');
  } else if (stage.mode === 'puthot') {
    putRow.classList.remove('display_off');
    hartRow.classList.add('display_off');
  } else {
    hartRow.classList.add('display_off');
    putRow.classList.add('display_off');
  }

  if (blockInfo.value) {
    blockInfo.value.textContent = stage.block_limit;
  }
  if (turnInfo.value) {
    turnInfo.value.textContent = stage.turn;
  }

  let stageJoinLink = stageJoinDiv.querySelector('.stage_join_link');
  if (!stageJoinLink) {
    stageJoinLink = document.createElement('a');
    stageJoinLink.classList.add('stage_join_link');
    stageJoinDiv.appendChild(stageJoinLink);
  }
  stageJoinLink.href = '/tutorial?stage=' + encodeURIComponent(id);
  stageJoinLink.innerText = 'はじめる';

  stageMap.appendChild(table);
  stageDetail.classList.remove('display_off');
  document.getElementById('menu_area').classList.add('select_back');
}

window.addEventListener('load', function () {
  getStageList();
});

function getStageList() {
  const url = './../api/tutorial';
  fetch(url)
    .then(function (response) {
      return response.json();
    })
    .then(function (json) {
      createStageList(json);
    });
}


const stageDetail = document.getElementById('stage_detail');
if (stageDetail) {
  stageDetail.addEventListener('click', function (e) {
    e.stopPropagation();
  });
}
