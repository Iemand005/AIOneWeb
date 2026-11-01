cmake_minimum_required(VERSION 3.20)
project(AIOneJS LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

if(EMSCRIPTEN)
    add_compile_options("-sMEMORY64=1")
    add_link_options("-sMEMORY64=1")
endif()

add_subdirectory(
    "../AIOne"
    "${CMAKE_CURRENT_BINARY_DIR}/AIOne"
)

if(NOT NODE_API_HEADERS_DIR)
    set(NODE_API_HEADERS_DIR
        "${CMAKE_CURRENT_SOURCE_DIR}/node_modules/node-api-headers/include")
endif()

if(NOT EXISTS "${NODE_API_HEADERS_DIR}/node_api.h")
    message(FATAL_ERROR
        "Node-API headers not found in '${NODE_API_HEADERS_DIR}'. "
        "Run 'npm install' or set NODE_API_HEADERS_DIR.")
endif()

if(EMSCRIPTEN)

    add_executable(AIOneWeb
        bindings/web/Main.cpp
    )

    target_include_directories(AIOneWeb PRIVATE
        "${CMAKE_CURRENT_SOURCE_DIR}/../AIOne/include"
    )

    target_link_options(AIOneWeb PRIVATE
        --bind
        -sMODULARIZE=1
        -sENVIRONMENT=worker
        -sFORCE_FILESYSTEM=1
        -lworkerfs.js
        -sALLOW_MEMORY_GROWTH=1
        -sMAXIMUM_MEMORY=4GB
        -g
        -sASSERTIONS=2
        -fexceptions
        -sINITIAL_MEMORY=32MB
        -sSTACK_SIZE=16MB
        --pre-js "${CMAKE_CURRENT_SOURCE_DIR}/workerfs-bridge.js"
    )

    target_link_libraries(AIOneWeb PRIVATE AIOneCore)



    set_target_properties(AIOneWeb PROPERTIES
        SUFFIX ".html"
    )
else()
    add_library(AIOneNode SHARED
        bindings/node/NodeAddon.cpp
    )

    target_link_libraries(AIOneNode PRIVATE AIOneCore)

    target_include_directories(AIOneNode PRIVATE
        "${NODE_API_HEADERS_DIR}"
        "${CMAKE_CURRENT_SOURCE_DIR}/node_modules/node-addon-api"
    )

    target_compile_definitions(AIOneNode PRIVATE
        NAPI_VERSION=8
        NODE_GYP_MODULE_NAME=AIOneNode
    )

    if(WIN32)
        set(NODE_API_DEF_DIR "${NODE_API_HEADERS_DIR}/../def")

        if(CMAKE_SYSTEM_PROCESSOR MATCHES "ARM64|arm64")
            set(NODE_API_MACHINE "arm64")
        elseif(CMAKE_SIZEOF_VOID_P EQUAL 8)
            set(NODE_API_MACHINE "x64")
        else()
            set(NODE_API_MACHINE "x86")
        endif()

        set(NODE_API_IMPORT_LIBS "")
        foreach(def_name node_api js_native_api)
            set(def_file "${NODE_API_DEF_DIR}/${def_name}.def")
            set(lib_file "${CMAKE_CURRENT_BINARY_DIR}/${def_name}.lib")
            add_custom_command(
                OUTPUT "${lib_file}"
                COMMAND "${CMAKE_AR}" /nologo /def:${def_file}
                        /machine:${NODE_API_MACHINE} /out:${lib_file}
                DEPENDS "${def_file}"
                COMMENT "Generating Node-API import library ${def_name}.lib"
                VERBATIM
            )
            list(APPEND NODE_API_IMPORT_LIBS "${lib_file}")
        endforeach()

        add_custom_target(AIOneNodeNodeApiImportLibs DEPENDS ${NODE_API_IMPORT_LIBS})
        add_dependencies(AIOneNode AIOneNodeNodeApiImportLibs)
    endif()

    target_link_libraries(AIOneNode PRIVATE
        AIOne::Core
        ${NODE_API_IMPORT_LIBS}
    )

    set_target_properties(AIOneNode PROPERTIES
        PREFIX ""
        SUFFIX ".node"
    )

endif()
