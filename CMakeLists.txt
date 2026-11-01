cmake_minimum_required(VERSION 3.20)
project(AIOneJS LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

if(EMSCRIPTEN)
    add_compile_options("-sMEMORY64=1")
    add_link_options("-sMEMORY64=1")
    # add_compile_options(--use-port=emdawnwebgpu)
    # add_link_options(--use-port=emdawnwebgpu)
endif()

add_subdirectory(
    "../AIOne"
    "${CMAKE_CURRENT_BINARY_DIR}/AIOne"
)
        
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
endif()
