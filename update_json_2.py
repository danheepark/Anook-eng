import json
import os

def update_file(filename, new_data):
    if not os.path.exists(filename):
        return
    with open(filename, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    for k, v in new_data.items():
        if k in data and isinstance(data[k], dict) and isinstance(v, dict):
            data[k].update(v)
        else:
            data[k] = v
            
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

base_path = 'frontend/src/locales'

updates = {
    'ko': {
        'chatPanel': {
            'autoReplyStaffChecked': '프론트 데스크 직원이 메시지를 확인했습니다. 곧 안내 드리겠습니다.',
            'autoReplyEmergency': '긴급 대응팀이 배정되었습니다. 신속히 조치하겠습니다. 안전한 곳에서 대기해 주시기 바랍니다.'
        }
    },
    'en': {
        'chatPanel': {
            'autoReplyStaffChecked': 'The front desk staff has checked your message. We will assist you shortly.',
            'autoReplyEmergency': 'An emergency response team has been dispatched. Please stay in a safe place.'
        }
    },
    'ja': {
        'chatPanel': {
            'autoReplyStaffChecked': 'フロントデスクのスタッフがメッセージを確認しました。すぐにご案内いたします。',
            'autoReplyEmergency': '緊急対応チームが派遣されました。安全な場所でお待ちください。'
        }
    },
    'zh': {
        'chatPanel': {
            'autoReplyStaffChecked': '前台工作人员已确认您的留言。我们将很快为您提供帮助。',
            'autoReplyEmergency': '紧急响应团队已被派遣。请在安全的地方等候。'
        }
    }
}

for loc in updates.keys():
    update_file(f'{base_path}/{loc}.json', updates[loc])

print("Updated JSONs")
