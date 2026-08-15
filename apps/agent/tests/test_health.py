from src.tools.system import calculate, get_current_time, query_system_info


def test_system_tools():
    time_str = get_current_time.invoke({})
    assert len(time_str) > 0

    calc_res = calculate.invoke({"expression": "2 + 3 * 4"})
    assert "14" in calc_res

    sys_info = query_system_info.invoke({})
    assert "System Status" in sys_info
