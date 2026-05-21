import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;

public class TestJson {
    public static void main(String[] args) throws Exception {
        String json = "{\"intent\": \"ROOM_SERVICE\", \"menu_items\": [{\"name\": \"모짜렐라 스틱\", \"quantity\": 3}, {\"name\": \"클래식 치즈버거\", \"quantity\": 4}, {\"name\": \"스테이크 샌드위치\", \"quantity\": 2, \"selected_option\": \"미디엄\"}], \"allergen_warning\": \"밀, 유제품\"}";
        ObjectMapper mapper = new ObjectMapper();
        Map<String, Object> entities = mapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        
        List<Map<String, Object>> menuItems = (List<Map<String, Object>>) entities.get("menu_items");
        for (Map<String, Object> item : menuItems) {
            String name = (String) item.get("name");
            System.out.println("Parsed name: [" + name + "]");
        }
    }
}
